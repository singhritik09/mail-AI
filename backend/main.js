import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { Redis } from 'ioredis';
import { Worker, Queue } from 'bullmq';
import LlamaAI from 'llamaai';
import { outlook_pass,CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, REFRESH_TOKEN, apiToken } from './secrets.js';


const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });


const imapConfig = {
    user: "skyvault11@outlook.com",
    password: outlook_pass,
    host: "outlook.office365.com",
    port: 993,
    tls: true,
};

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});

// Function to send mail
async function sendMail(senderEmail, subject, text) {
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        const transport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'skyvault11@gmail.com',
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token
            }
        });

        const mailOptions = {
            from: 'skyvault11@gmail.com',
            to: senderEmail,
            subject: subject,
            text: text,
        };

        const result = await transport.sendMail(mailOptions);
        console.log('Email sent:', result);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Fetch latest email from Gmail
async function getGmailEmails() {
    try {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        const result = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 1,
        });

        const latestId = result.data.messages[0].id;
        console.log("Gmail Message ID:", latestId);

        const messageContent = await gmail.users.messages.get({
            userId: 'me',
            id: latestId,
        });

        const payload = messageContent.data.payload;
        const headers = payload.headers;
        const parts = payload.parts;

        let subject = '';
        let textBody = '';
        let senderEmail = '';

        headers.forEach(header => {
            if (header.name === 'Subject') {
                subject = header.value;
            } else if (header.name === 'From') {
                const emailMatch = header.value.match(/<([^>]+)>/);
                senderEmail = emailMatch ? emailMatch[1] : header.value;
            }
        });

        if (parts) {
            parts.forEach(part => {
                if (part.mimeType === 'text/plain' && part.body.data) {
                    textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
            });
        }

        return { senderEmail, subject, textBody, latestId };
    } catch (error) {
        console.error('Error fetching latest email from Gmail:', error);
        throw error;
    }
}
// Fetch latest email from outlook
function getOutlookEmails(callback) {
  const imap = new Imap(imapConfig);

  imap.once('error', function(err) {
      callback(err);
  });

  imap.once('ready', function() {
      imap.openBox('INBOX', false, function(err, box) {
          if (err) {
              imap.end();
              return callback(err);
          }

          function processMessages() {
              const f = imap.seq.fetch(box.messages.total + ':*', { bodies: ['HEADER.FIELDS (FROM SUBJECT)', 'TEXT'], struct: true });

              f.on('message', function(msg) {
                  let header, body, uid;

                  msg.on('body', function(stream, info) {
                      if (info.which === 'HEADER.FIELDS (FROM SUBJECT)') {
                          let buffer = '';
                          stream.on('data', function(chunk) {
                              buffer += chunk.toString('utf8');
                          });
                          stream.once('end', function() {
                              header = Imap.parseHeader(buffer);
                              uid = msg.attributes && msg.attributes.uid; // Ensure msg.attributes is defined
                          });
                      } else if (info.which === 'TEXT') {
                          simpleParser(stream, function(err, parsed) {
                              if (err) {
                                  return callback(err);
                              }
                              body = parsed.text.replace(/<[^>]*>/g, '');
                              // Callback with the extracted email data
                              callback(null, { senderEmail: header.from[0], subject: header.subject[0], textBody: body, latestId: uid });
                          });
                      }
                  });

                  msg.once('error', function(err) {
                      callback(err);
                  });
              });

              f.once('error', function(err) {
                  callback(err);
              });

              f.once('end', function() {
                  console.log('No more messages to fetch.');
              });
          }

          processMessages();
          const interval = setInterval(processMessages, 30 * 1000);

          // End the connection when exiting
          imap.once('close', function() {
              clearInterval(interval);
              imap.end();
          });
      });
  });

  imap.connect();
}



// Queue setup
const emailFetchQueue = new Queue("emailqueue");
const responseQueue = new Queue("responsequeue", { connection });

async function fetchMessages(senderEmail, subject, textBody) {
    const res = await emailFetchQueue.add("Email", {
        sender: senderEmail,
        subject: subject,
        body: textBody,
    });
    console.log("Job added to the queue", res.id);
}

// AI model interaction
const llamaAPI = new LlamaAI(apiToken);

const workerEmailFetch = new Worker("emailqueue", async (job) => {
    const sender = job.data.sender;
    const subject = job.data.subject;
    const body = job.data.body;
    const query = "Generate a reply for the email with one of the following labels: Interested, Not Interested, More Information.\n";
    const content = `Subject: ${subject}\n\nBody: ${body}\n\n${query}`;

    const apiRequestJson = {
        "messages": [
            { "role": "user", "content": content },
        ],
        "functions": [
            {
                "name": "get_email_reply",
                "description": "Get the reply for a given email text",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "The reply for the email",
                        },
                        "label": { "type": "string", "enum": ["Interested", "Not Interested", "More Information"] },
                    },
                },
                "required": ["content", "label"],
            }
        ],
        "stream": false,
        "function_call": "get_email_reply",
    };

    try {
        const response = await llamaAPI.run(apiRequestJson);
        const functionCall = response.choices[0].message.function_call;
        if (functionCall && functionCall.name === 'get_email_reply') {
            const replyContent = functionCall.arguments.content;
            const label = functionCall.arguments.label;

            console.log(`Function call: ${functionCall.name}`);
            console.log(`Reply Content: ${replyContent}`);
            console.log(`Label: ${label}`);

            await responseQueue.add("response", {
                jobId: job.id,
                response: replyContent,
                label: label,
                sender: sender
            });

            return { replyContent, label };
        } else {
            console.log('No function call in the response.');
        }
    } catch (error) {
        console.error('Error fetching response from AI model:', error);
        throw error;
    }
}, { connection });

async function sendReplies() {
    const workerResponse = new Worker('responsequeue', async (job) => {
        const replyContent = job.data.response;
        const label = job.data.label;
        const senderEmail = job.data.sender;
        console.log("Sender Email: ", senderEmail);
        try {
            await sendMail(senderEmail, `Response - ${label}`, replyContent);
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }, { connection });
}

const processedEmailIds = new Set();

async function processEmails() {
  try {
      // Outlook emails
      getOutlookEmails(async (err, outlookData) => {
          if (err) {
              console.error('Error fetching Outlook emails:', err);
              return;
          }

          if (!processedEmailIds.has(outlookData.latestId) && outlookData.senderEmail !== 'skyvault11@outlook.com') {
              await fetchMessages(outlookData.senderEmail, outlookData.subject, outlookData.textBody);
              processedEmailIds.add(outlookData.latestId);
              await sendReplies();
              console.log('Processed Outlook emails successfully.');
          } else {
              console.log("Already processed Outlook email or email from self.");
          }
      });
    // Gmail
      const gmailData = await getGmailEmails();
      if (!processedEmailIds.has(gmailData.latestId) && gmailData.senderEmail !== 'skyvault11@gmail.com') {
          await fetchMessages(gmailData.senderEmail, gmailData.subject, gmailData.textBody);
          processedEmailIds.add(gmailData.latestId);
          await sendReplies();
          console.log('Processed Gmail emails successfully.');
      } else {
          console.log("Already processed Gmail email or email from self.");
      }
  } catch (error) {
      console.error('Error processing emails:', error);
  }
}

const intervalTime = 40 * 1000; 
setInterval(processEmails, intervalTime);

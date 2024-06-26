import express from 'express';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import fetchEmails from './producer.js';
import { Redis } from "ioredis";
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, REFRESH_TOKEN } from './secrets.js';
// import { sendReplies } from './worker.js';
import { Worker, Queue } from "bullmq";
import LlamaAI from 'llamaai';
import { apiToken } from './secrets.js';

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

export async function sendMail(senderEmail, subject, text) {
    try {
        const accessToken = await oAuth2Client.getAccessToken();
        console.log("Access:", accessToken);
        const transport = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'skyvault11@gmail.com',
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token // Use accessToken.token
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
        return error;
    }
}

async function getLatestMail(auth) {
    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const result = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 1,
        });
        let latestId;
        latestId = result.data.messages[0].id;
        console.log("Message ID:", latestId);

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

        for (let i = 0; i < headers.length; i++) {
            if (headers[i].name === 'Subject') {
                subject = headers[i].value;
            } else if (headers[i].name === 'From') {
                const fromHeader = headers[i].value;
                // Extract the email address from the From header
                const emailMatch = fromHeader.match(/<([^>]+)>/);
                senderEmail = emailMatch ? emailMatch[1] : fromHeader;
            }
        }

        if (parts) {
            parts.forEach(part => {
                if (part.mimeType === 'text/plain' && part.body.data) {
                    textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
            });
        }

        return { senderEmail, subject, textBody, latestId };
    } catch (error) {
        console.error('Error fetching latest email:', error);
        throw error;
    }
}

const emailFetchQueue = new Queue("emailqueue");

async function fetchMessages(senderEmail, subject, textBody) {
    const res = await emailFetchQueue.add("Email", {
        sender: senderEmail,
        subject: subject,
        body: textBody,
    });
    console.log("Job added to the queue", res.id);
}

const llamaAPI = new LlamaAI(apiToken);
const responseQueue = new Queue("responsequeue", { connection });

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
        console.error('Error fetching response:', error);
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

const processedEmailIds = new Set(); // Set to store processed email IDs

// Function to handle fetching emails, processing them, and sending replies
async function processEmails() {
    try {
        const { senderEmail, subject, textBody, latestId } = await getLatestMail(oAuth2Client);

        // Check if emailId is in processedEmailIds set
        if (!processedEmailIds.has(latestId) && senderEmail !== 'skyvault11@gmail.com') {
            await fetchMessages(senderEmail, subject, textBody);
            processedEmailIds.add(latestId); // Add emailId to processed set
            await sendReplies();
            console.log('Processed emails successfully.');
        } else {
            console.log("Already processed email or email from self.");
        }
    } catch (error) {
        console.error('Error processing emails:', error);
    }
}

// Interval in milliseconds (20 seconds)
const intervalTime = 20 * 1000; // 20 seconds

// Set interval to execute processEmails function
setInterval(processEmails, intervalTime);

// Initial execution
processEmails();

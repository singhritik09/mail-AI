import express from 'express';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import fetchEmails from './producer.js';
import workerEmailFetch from './worker.js';
import { Redis } from "ioredis";
import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URL, REFRESH_TOKEN } from './secrets.js';

const connection = new Redis({
    host: 'localhost',
    port: 6379,
});
const port = 8000;
const app = express();

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendMail(senderEmail) {
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
                accessToken: accessToken
            }
        })

        const mailOptions = {
            from: 'skyvault11@gmail.com',
            to: senderEmail,
            subject: 'This is the mail',
            text: 'Hello from my side',
            html: '<h1> Check working of mail function </h1>'
        }

        const result = await transport.sendMail(mailOptions);
    }
    catch (error) {
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

        const latestId = result.data.messages[0].id;
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
        let htmlBody = '';
        let senderEmail = '';

        for (let i = 0; i < headers.length; i++) {
            if (headers[i].name === 'Subject') {
                subject = headers[i].value;
            } else if (headers[i].name === 'From') {
                senderEmail = headers[i].value;
            }
        }

        if (parts) {
            parts.forEach(part => {
                if (part.mimeType === 'text/plain') {
                    textBody = Buffer.from(part.body.data, 'base64').toString();
                } else if (part.mimeType === 'text/html') {
                    htmlBody = Buffer.from(part.body.data, 'base64').toString();
                }
            });
        }
        return { senderEmail, subject, textBody };
    } catch (error) {
        console.error('Error fetching latest email:', error);
    }
}

app.get("/", (req, res) => {
    sendMail("singhritik2711@gmail.com")
        .then((result) => console.log('Email sent ... ', result))
        .catch((error) => console.log(error.message));
    res.send("Hello");
})
app.get("/fetchEmail", async (req, res) => {
    try {
        const { senderEmail, subject, textBody } = await getLatestMail(oAuth2Client);
        await fetchEmails(senderEmail, subject, textBody);
        res.send("Fetching emails...");
    }
    catch (error) {
        console.error("Error fetching or queuing email:", error);
        res.status(500).send("Error fetching or queuing email");
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

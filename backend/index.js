import express from 'express';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const port = 8000;
const app = express();

const CLIENT_ID = '102082836200-43dthnd6pq1vs0nh8e9fspsqscjfb112.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = '1//044ugp27yM4pLCgYIARAAGAQSNwF-L9IrN-gYBSiOdiMEhJSB_Cp35IN0fGWZOG5ikHqEfGUV7uNgWShat1Awr7MxmBpx6wcvalE';

//Access token will be generated each time 3600 seconds
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendMail() {
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
            from: 'singhritik2711@gmail.com',
            to: 'skyvault11@gmail.com',
            subject: 'This is the mail',
            text: 'Hello from my side',
            html: '<h1> Wow it`s working </h1>'
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
        console.log("Sender's Email:", senderEmail);
        console.log("Subject:", subject);
        console.log("Text Body:", textBody);
        console.log("HTML Body:", htmlBody);

    } catch (error) {
        console.error('Error fetching latest email:', error);
    }
}




app.get("/", (req, res) => {
    sendMail()
        .then((result) => console.log('Email sent ... ', result))
        .catch((error) => console.log(error.message));
    res.send("Hello");
})
app.get("/fetchEmails", (req, res) => {
    getLatestMail(oAuth2Client);
    res.send("Fetching emails...");
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})



// secret
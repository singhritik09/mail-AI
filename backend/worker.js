import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";
import LlamaAI from 'llamaai';
import { apiToken } from './secrets.js';

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});

const llamaAPI = new LlamaAI(apiToken); 
const responseQueue = new Queue("response-queue", { connection });

const workerEmailFetch = new Worker("email-queue", async (job) => {
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
                label: label
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

export default workerEmailFetch;

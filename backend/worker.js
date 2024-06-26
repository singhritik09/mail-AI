import { Worker } from "bullmq";
import { Redis } from "ioredis";
import OpenAIApi from "openai";

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});

const api_key = "sk-proj-S5ROCRK7dAbDEYyEVPVrT3BlbkFJ6FxljroeEG4ILrQieTam";
const openai = new OpenAIApi({ apiKey: api_key });

const runPrompt = async (body) => {
    const comm = "Generate a suitable response for the email: ";
    const prompt = comm.concat(body);

    try {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: prompt,
            max_tokens: 2048,
            temperature: 1,
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            console.log("Answer: ", response.data.choices[0].text);
        } else {
            console.error("Empty or invalid response from OpenAI API");
        }
    } catch (error) {
        console.error("Error from OpenAI API:", error);
    }
};
const workerEmailFetch = new Worker("email-queue", async (job) => {
    const subject = job.data.subject;
    const body = job.data.body;
    const a = subject.concat(" ");
    const data = a.concat(body);
    console.log("Data ", data);

    await runPrompt(body); // Adjust as needed for your prompt processing

}, { connection });

// workerEmailFetch.on('failed', (job, err) => {
//     console.log(`Job ${job.id} failed with ${err.message}`);
// });

// workerEmailFetch.on('completed', (job) => {
//     console.log(`Job ${job.id} has been completed successfully`);
// });

// workerEmailFetch.on('drained', () => {
//     console.log('Worker has processed all jobs and is idle');
// });

export default workerEmailFetch;

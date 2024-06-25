import { Worker } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null
});

const sendemail = (ms) => new Promise((res, rej) => setTimeout(() => res(), 5 * 1000))

const workerEmailFetch = new Worker("email-queue", async (job) => {
    console.log('Message: ', job.data.body);
},{connection}).run;

export default workerEmailFetch;

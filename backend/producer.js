import { Queue } from 'bullmq';

const emailFetchQueue = new Queue("email-queue");

async function fetchMessages(senderEmail, sub, txt){
    const res= await emailFetchQueue.add("Email",{
        sender:senderEmail,
        subject:sub,
        body:txt,
    });
    console.log("Job added to the queue",res.id);   
}
const a="singhritik2711"
const b="Query"
const c="Body of the message"
const d="hello";

fetchMessages(a,b,c,d);

export default fetchMessages;
import { Queue } from 'bullmq';

const emailFetchQueue = new Queue("email-queue");

async function fetchMessages(senderEmail, sub, txt){
    const res= await emailFetchQueue.add("Email",{
        sender:senderEmail,
        subject:sub,
        body:txt,
    });
    console.log("Job added to the queue 1",res.id);   
}

export default fetchMessages;
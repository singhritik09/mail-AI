Here's a brief description of the libraries and tools used in the provided Node.js script:

Google APIs (googleapis): Used for interacting with Gmail API to fetch and send emails securely using OAuth2 authentication.

Nodemailer: Node.js module for sending emails, integrated with Gmail's OAuth2 credentials to handle SMTP transport.

Imap: Allows fetching emails from Outlook using IMAP protocol, enabling real-time email processing and monitoring.

Mailparser (simpleParser): Parses email content retrieved via IMAP into structured data, handling both HTML and plain text formats.

Redis: In-memory data structure store, utilized here for queue management and job processing between email fetching and reply sending.

BullMQ (Worker, Queue): Redis-backed queue system for managing asynchronous tasks, facilitating email processing and reply generation.

LlamaAI: AI model integration via API for generating email replies based on given content and predefined labels (Interested, Not Interested, More 
Information), enhancing automated email handling capabilities.


STEPS TO RUN THE APPLICATION

Clone the project

Install packages: npm install

Download redis image and run the container for it: docker run -dt -p 6379:6379 redis/redis-stack-server:latest

Once the container is running start the application: node main.js

Test the application by sending emails to skyvault11@gmail.com and skyvault11@outlook.com
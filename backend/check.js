import LlamaAI from 'llamaai';
import { apiToken } from './secrets.js';

const llamaAPI = new LlamaAI(apiToken);
const subject = "Regarding the email";
const body = "I am interested in the product would like to know more";
const content = `${subject}. ${body}`;
const question="I am not interested in this shit?"
const quer=`${question} What is the mood in this text?`
const apiRequestJson={
  "messages":[
    { "role": "user", "content":`${content}`},
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
          "label": { "type": "string", "enum": ["Interested", "Not Interested","More Information"] },
        },
      },
      "required": ["content", "label"],
    }
  ],
  "stream": false,
  "function_call": "get_email_reply",
};

// Execute the Request
llamaAPI.run(apiRequestJson)
  .then(response => {
    const functionCall = response.choices[0].message.function_call;
    if (functionCall && functionCall.name === 'get_email_reply') {
      const content = functionCall.arguments.content;
      const label = functionCall.arguments.label;

      console.log(`Function call: ${functionCall.name}`);
      console.log(`Content: ${content}`);
      console.log(`Label: ${label}`);      
    } else {
      console.log('No function call in the response.');
    }
  })
  .catch(error => {
    console.error('Error fetching response:', error);
  });

import OpenAIApi from "openai";

const api_key = "sk-proj-S5ROCRK7dAbDEYyEVPVrT3BlbkFJ6FxljroeEG4ILrQieTam";

const openai = new OpenAIApi({
    apiKey:api_key
});

async function main() {
    const stream = await openai.chat.completions.create({
        model: "babbage-002",
        messages: [{ role: "user", content: "Say this is a test" }],
        stream: true,
    });
    for await (const chunk of stream) {
        process.stdout.write(chunk.choices[0]?.delta?.content || "");
    }
}

main();
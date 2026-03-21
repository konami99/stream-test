// SAM local start-api runs on port 3000 by default
// For Lambda Function URL streaming, use sam local start-api
const LAMBDA_URL = process.env.LAMBDA_URL || "http://localhost:3001/2015-03-31/functions/StreamingFunction/invocations";

const prompt = process.argv[2] || "Hello, what can you help me with?";

async function testStreaming() {
  console.log(`Sending prompt: "${prompt}"`);
  console.log(`Target: ${LAMBDA_URL}`);
  console.log("---");

  // Lambda invoke API expects a Function URL event envelope
  const event = {
    body: JSON.stringify({ prompt }),
    requestContext: { http: { method: "POST" } },
  };

  const response = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value, { stream: true }));
  }

  console.log("\n---");
  console.log("Stream complete.");
}

testStreaming().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

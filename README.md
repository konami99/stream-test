# stream-test

A local proxy server and test client for validating AWS Lambda streaming responses, including AWS Bedrock AgentCore endpoints.

## What it does

- **`server.js`** — Local HTTP proxy with a chat UI. Forwards POST requests to a Lambda endpoint (with optional AWS SigV4 signing for Lambda Function URLs and Bedrock AgentCore). Streams the response back chunk-by-chunk.
- **`index.js`** — Minimal CLI test client. Sends a single prompt to a Lambda and streams the response to stdout.
- **`chat.html`** — Simple browser chat UI served by `server.js`.
- **`expo-client.ts`** — TypeScript streaming client for use with `@expo/fetch`.

## Setup

```bash
npm install
cp .env.example .env  # add LAMBDA_URL and optional BEARER_TOKEN
```

## Usage

### Chat UI (proxy server)

```bash
npm start
# Open http://localhost:3000
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `LAMBDA_URL` | `http://localhost:8080/invocations` | Target Lambda or AgentCore endpoint |
| `PORT` | `3000` | Local server port |
| `AWS_REGION` | `us-west-2` | AWS region for SigV4 signing |
| `BEARER_TOKEN` | — | JWT bearer token; `sub` claim used as `user_id` |

SigV4 signing is applied automatically when `LAMBDA_URL` contains `lambda-url` or `bedrock-agentcore`.

### CLI test client

```bash
npm test
node index.js "Your prompt here"
LAMBDA_URL=https://your-endpoint.lambda-url.us-west-2.on.aws/ node index.js
```

## Supported endpoints

- **SAM local** — `http://localhost:8080/invocations` (default)
- **Lambda Function URL** — signed automatically via SigV4
- **AWS Bedrock AgentCore** — signed automatically with `bedrock-agentcore` service

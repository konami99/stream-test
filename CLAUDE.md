# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm test` or `node index.js` — Run the streaming test client against the Lambda endpoint
- Custom prompt: `node index.js "Your prompt here"`
- Custom endpoint: `LAMBDA_URL=http://your-endpoint.com node index.js`

## Architecture

This is a single-file Node.js ES module (`index.js`) that tests AWS Lambda streaming responses.

**Flow:** Reads `LAMBDA_URL` env var (default: `http://localhost:3000/`) → POSTs a JSON prompt to the Lambda → streams the response body to stdout using the Web Streams API (`getReader()` + `TextDecoder`).

**No dependencies:** Uses Node.js 18+ built-in global `fetch` with Web Streams streaming support.

**Typical use case:** Validating that a Lambda function (run via SAM local or a Lambda Function URL) correctly streams responses rather than buffering.

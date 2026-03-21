import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAMBDA_URL = process.env.LAMBDA_URL || "http://localhost:3000/";
const PORT = process.env.PORT || 8080;
const REGION = process.env.AWS_REGION || "us-west-2";

const parsed = new URL(LAMBDA_URL);
const needsSigning = parsed.hostname.includes("lambda-url");

async function signedFetch(url, body) {
  if (!needsSigning) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  const bodyBytes = Buffer.from(body);
  const request = new HttpRequest({
    method: "POST",
    hostname: parsed.hostname,
    path: parsed.pathname || "/",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(bodyBytes.byteLength),
      host: parsed.hostname,
    },
    body: bodyBytes,
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: "lambda",
    sha256: Sha256,
  });

  const signed = await signer.sign(request);

  return fetch(url, {
    method: "POST",
    headers: signed.headers,
    body: bodyBytes,
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const html = fs.readFileSync(path.join(__dirname, "chat.html"));
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { prompt } = JSON.parse(body);
        const lambdaRes = await signedFetch(
          LAMBDA_URL,
          JSON.stringify({ prompt })
        );

        if (!lambdaRes.ok) {
          res.writeHead(lambdaRes.status);
          res.end(await lambdaRes.text());
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-Content-Type-Options": "nosniff",
        });
        res.socket?.setNoDelay(true);

        const reader = lambdaRes.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          process.stdout.write(`[chunk] ${JSON.stringify(decoder.decode(value, { stream: true }))}\n`);
          res.write(value);
        }
        res.end();
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(err.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Chat UI: http://localhost:${PORT}`);
  console.log(`Proxying to: ${LAMBDA_URL}`);
});

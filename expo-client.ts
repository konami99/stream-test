/**
 * Expo client for invoking StreamingFunction directly with Supabase auth.
 *
 * Install:
 *   npx expo install @aws-sdk/client-cognito-identity
 *   npx expo install @aws-sdk/credential-provider-cognito-identity
 *   npx expo install @smithy/signature-v4
 *   npx expo install @aws-crypto/sha256-js
 */

import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { supabase } from "./supabaseClient"; // your existing Supabase client

const REGION = "us-west-2";
const IDENTITY_POOL_ID = "us-west-2:<your-identity-pool-id>"; // from stack output: IdentityPoolId
const LAMBDA_URL = "https://<your-function-url>.lambda-url.us-west-2.on.aws/"; // from stack output: StreamingFunctionURL

async function getCredentials() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  return fromCognitoIdentityPool({
    client: new CognitoIdentityClient({ region: REGION }),
    identityPoolId: IDENTITY_POOL_ID,
    logins: {
      [`https://${IDENTITY_POOL_ID.split(":")[0]}.supabase.co/auth/v1`]: session.access_token,
    },
  })();
}

/**
 * Invoke the streaming Lambda and yield tokens as they arrive.
 *
 * Usage:
 *   for await (const token of invokeStreaming("Hello")) {
 *     setResponse(prev => prev + token);
 *   }
 */
export async function* invokeStreaming(prompt: string): AsyncGenerator<string> {
  const credentials = await getCredentials();
  const url = new URL(LAMBDA_URL);
  const body = JSON.stringify({ prompt });

  const signer = new SignatureV4({
    credentials,
    region: REGION,
    service: "lambda",
    sha256: Sha256,
  });

  const signed = await signer.sign({
    method: "POST",
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      "content-type": "application/json",
      host: url.hostname,
    },
    body,
  });

  const response = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: signed.headers as Record<string, string>,
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        yield JSON.parse(raw) as string;
      } catch {
        yield raw;
      }
    }
  }
}

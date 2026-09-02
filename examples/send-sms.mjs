#!/usr/bin/env node
/**
 * Send an SMS through the volai REST API - no dependencies, Node 20+
 * (uses the global fetch and crypto.randomUUID()).
 *
 * Usage:
 *   VOLAI_API_KEY=vk_... node send-sms.mjs +420777123456 "Hello from volai"
 *
 * API reference: https://volai.cz/docs/api (POST /v1/messages).
 */

const BASE_URL = "https://volai.cz/v1";

const apiKey = process.env.VOLAI_API_KEY;
if (!apiKey) {
  console.error("Set VOLAI_API_KEY first - get a key at https://volai.cz/en/api-and-mcp");
  process.exit(1);
}

const [to, ...bodyParts] = process.argv.slice(2);
const body = bodyParts.join(" ");
if (!to || !body) {
  console.error("Usage: node send-sms.mjs <+420...> <message text>");
  process.exit(1);
}

const response = await fetch(`${BASE_URL}/messages`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    // Idempotency-Key protects against sending the message twice if the
    // request needs to be retried (network error, timeout) - volai
    // remembers the response for 24 hours and replays it instead of
    // sending a second SMS. See https://volai.cz/docs/api.
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({ to, body }),
});

const data = await response.json();
if (!response.ok) {
  console.error(`volai API error (${response.status}):`, data.error?.message ?? data);
  process.exit(1);
}

console.log(`Sent. id=${data.id} status=${data.status} priceHal=${data.priceHal} segments=${data.segments}`);

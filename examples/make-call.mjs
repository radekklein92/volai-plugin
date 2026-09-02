#!/usr/bin/env node
/**
 * Place a trial voice-agent call through the volai REST API - no
 * dependencies, Node 20+ (global fetch and crypto.randomUUID()).
 *
 * A trial call needs neither your own phone number nor a saved agent: it
 * goes out from volai's shared demo number with a system prompt you give
 * it right here. To call through a number and agent you already created,
 * swap the body for {to, agentId} - see https://volai.cz/docs/api.
 *
 * Usage:
 *   VOLAI_API_KEY=vk_... node make-call.mjs +420777123456 \
 *     "You are a friendly receptionist for a small cafe. Ask what the caller needs."
 */

const BASE_URL = "https://volai.cz/v1";

const apiKey = process.env.VOLAI_API_KEY;
if (!apiKey) {
  console.error("Set VOLAI_API_KEY first - get a key at https://volai.cz/en/api-and-mcp");
  process.exit(1);
}

const [to, ...promptParts] = process.argv.slice(2);
const systemPrompt = promptParts.join(" ");
if (!to || !systemPrompt) {
  console.error('Usage: node make-call.mjs <+420...> "<system prompt for the agent>"');
  process.exit(1);
}

const response = await fetch(`${BASE_URL}/calls`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    // See send-sms.mjs for why this header matters on POST requests.
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({ to, systemPrompt }),
});

const data = await response.json();
if (!response.ok) {
  console.error(`volai API error (${response.status}):`, data.error?.message ?? data);
  process.exit(1);
}

console.log(`Calling. id=${data.id} status=${data.status} from=${data.from} (trial call from volai's demo number)`);

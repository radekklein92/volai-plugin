---
name: volai
description: Czech telephony API and MCP for apps and AI agents - numbers, calls, SMS, voice agent. Use when the user wants phone calls, SMS or a voice agent in their app.
---

# volai

Czech Twilio for vibe coders. One API and one MCP server for phone
numbers, calls, SMS and a voice AI agent. Prices in Czech crowns and
hellers, no contract, billed by the second.

## What volai is

volai buys a phone number on the Czech network, can call from and to it,
send SMS, and attach a voice AI agent (ElevenLabs voice, your prompt) to
it. The whole platform is available through two equally capable
interfaces:

- **MCP server** - 31 tools, recommended for AI editors and agents
  (Claude Code, Cursor, Windsurf).
- **REST API v1** - 37 endpoints, same data, same key, a good fit for
  your own backend.

Both interfaces share one API key, one rate limit and the same record
shapes. The only thing deliberately missing from MCP is releasing a
purchased number (`DELETE /v1/numbers/{e164}`) - an irreversible action
better left to the portal or REST. Tax documents and billing details
(company ID, VAT ID, company name) also stay outside the API - those
live only in the portal, under `/en/credit` and `/en/settings`.

## Authentication

Every request (MCP and REST) carries the API key in a header:

```
Authorization: Bearer vk_YOUR_KEY
```

Get a key in the volai portal under **API and MCP** (`/en/api-and-mcp`)
after signing up at `/en/auth/signup`. Keys are created and revoked only
in the portal - on principle it doesn't work through the API itself, since
that would let a key mint another key.

## Base URL

```
https://volai.cz
```

## Conventions that apply everywhere

- **Phone numbers are always E.164** with a country code: `+420777123456`.
- **Money is in hellers** (1/100 CZK, the `*Hal` fields), some responses also include
  crowns (`*Czk`). Never round it yourself.
- **Timestamps are unix milliseconds** (`createdAt`, `startedAt`, `boughtAt`).
- **A call, SMS or number purchase costs real money** and cannot be
  reversed. Don't retry a failed action "just in case" - use
  `Idempotency-Key` instead.
- **Credit is topped up only in the portal** at `/en/credit`. It cannot be
  topped up via the API or MCP, and that's intentional: paying is a human
  step, not an agent's.

## MCP server

Install into Claude Code (similarly Cursor, Windsurf - `http` transport):

```bash
claude mcp add --transport http volai https://volai.cz/mcp \
  --header "Authorization: Bearer vk_YOUR_KEY"
```

31 tools over the same service layer as the REST API:

| Tool | What it does |
|---|---|
| `get_balance` | Current account credit balance |
| `list_numbers` | Phone numbers on the account, including routing |
| `search_available_numbers` | Numbers available to buy (Prague, Brno, internet 910) |
| `buy_number` | Buys a number - random, from a region, or a specific one from the offer |
| `find_number_address` | Operator address-registry cascade: postal code -> municipality -> part -> street -> house number (or the whole address in one `query`) |
| `order_number_from_region` | Orders a number from a region outside the standard offer (Ostrava, Plzen...) |
| `list_number_orders` | Status of out-of-region number orders |
| `set_number_routing` | Sets number routing (agent / forward / SIP / none) |
| `get_sip_credentials` | SIP login credentials for a number, for your own PBX |
| `send_sms` | Sends an SMS to a Czech or Slovak number |
| `list_messages` | History of sent SMS |
| `make_call` | Starts an outbound call (via an agent, a plain bridge between two numbers, or a trial call with no number of your own) |
| `list_calls` | Call history (inbound and outbound) |
| `get_call` | Call detail including transcript, summary and recorded data (`data`); `waitSecs` waits for it to finish instead of polling |
| `list_voices` | Voice catalog for the agent `voiceId` field (currently a single entry) |
| `create_agent` | Creates a voice agent (name, system instructions, voice, tools, transfer, data fields) |
| `list_agents` | List of voice agents on the account |
| `update_agent` | Updates an existing agent, including `toolIds`, `transferTo`, `dataFields`, `recordCalls` |
| `delete_agent` | Deletes an agent (a number attached to it stays) |
| `list_tools` | Webhook tools on the account (header values masked) |
| `create_tool` | Creates a webhook tool the agent can call during a call |
| `update_tool` | Updates a tool (`params` and `headers` are always sent in full) |
| `delete_tool` | Deletes a tool and returns the agents it stopped working for |
| `get_webhook` | Current webhook target and subscribed events |
| `set_webhook` | Sets the target and events; an empty `url` removes the webhook |
| `create_relay_lease` | One-time SIP slot for an outbound call by your own (BYO) agent |
| `list_relay_leases` | List of relay leases (`pending` / `active`) |
| `cancel_relay_lease` | Returns an unused lease to the pool |
| `add_to_dnc` | Adds a number to the do-not-call list |
| `list_dnc` | Lists the do-not-call list |
| `remove_from_dnc` | Removes a number from the do-not-call list |

Every tool's response is a text block (a human sentence in English, a
blank line, JSON with the data) plus the same data in `structuredContent`
for clients that can consume machine-readable output. When an action
fails, the result carries `isError: true` and an English explanation.

Every tool also reports MCP annotations that a client uses to decide
whether to ask the user for confirmation:

- `readOnlyHint: true` - all `list_*` and `get_*` tools, read-only.
- `destructiveHint: true` - `delete_agent`, `delete_tool`,
  `cancel_relay_lease`, `remove_from_dnc`. Get these confirmed by the user.
- `idempotentHint: false` - billable actions (`send_sms`, `make_call`,
  `buy_number`, `order_number_from_region`, `create_agent`,
  `create_relay_lease`) and `create_tool`. A second call sends a second
  message and charges a second amount (for `create_tool`, creates a
  second tool), so a client must never retry these on its own after a
  timeout.

## REST API v1

The full reference with examples is at `/en/docs/api`; here's an overview of
all 37 endpoints (everything JSON, prices always in hellers):

### Balance

- `GET /v1/balance` - account balance

```bash
curl https://volai.cz/v1/balance \
  -H "Authorization: Bearer vk_YOUR_KEY"
```

### Numbers

- `GET /v1/numbers` - list of numbers on the account
- `POST /v1/numbers` - buys a number (empty body `{}`, or `{"e164": "..."}`,
  or `{"region": "praha" | "brno" | "internet"}`)
- `GET /v1/numbers/available` - offer of available numbers by region
- `PATCH /v1/numbers/{e164}` - changes routing (`agent` / `forward` / `sip` / `none`)
- `DELETE /v1/numbers/{e164}` - releases the number back to the pool
- `GET /v1/numbers/{e164}/sip` - SIP login credentials

```bash
curl -X POST https://volai.cz/v1/numbers \
  -H "Authorization: Bearer vk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Numbers from a region outside the standard offer

Ostrava, Plzen, Ceske Budejovice and other regions aren't in the pool -
they're ordered against a real premises address from the operator's
registry.

- `GET /v1/numbers/address-options` - address cascade: send `psc` and get
  municipalities, add `obec` -> municipality parts, `cobce` -> streets,
  `ulice` -> house numbers. Once `cp` is chosen, `recap` returns a
  human-readable address. Don't make up codes yourself, only ones from
  here are valid. Faster path: send the whole address as `query` (e.g.
  `"Nadrazni 100, 702 00 Ostrava"`) and the server drives the cascade
  itself - it returns either ready-made codes + `recap`, or just the level
  where the address is ambiguous (`ambiguousLevel`), to choose from.
- `POST /v1/numbers/orders` - orders a number on those codes. Usually
  returns the finished number in `e164` with status `done` within a
  minute; if it doesn't succeed on the first try, it stays `pending` and
  a cron job finishes it.
- `GET /v1/numbers/orders` - order status: `pending`, `provisioning`,
  `done`, `failed` (reason in `error`, nothing was charged).

### Messages

- `GET /v1/messages` - history of sent SMS
- `POST /v1/messages` - sends an SMS (+420 / +421 only)
- `GET /v1/messages/{id}` - message detail

```bash
curl -X POST https://volai.cz/v1/messages \
  -H "Authorization: Bearer vk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+420777123456", "body": "Hi from volai! - My App"}'
```

The API cannot see inbound SMS. A custom sender name is not supported -
sign your name directly in the message text.

### Calls

- `GET /v1/calls` - call history (optionally `direction=in|out`)
- `POST /v1/calls` - starts a call: pass exactly one of `agentId` (the
  agent handles the conversation), `from` (a plain bridge between two
  numbers), or `systemPrompt` (a trial call with no number of your own,
  see below)
- `GET /v1/calls/{id}` - call detail including `transcript`, `summary` and
  `data` (what the agent recorded from the call per its `dataFields`; a
  `null` value means it never came up during the call); optional
  `waitSecs` (0-45, default 0) waits until the call reaches a terminal
  state and returns `stillRunning: true` if the time runs out first
- `GET /v1/calls/{id}/recording` - the call recording as MP3 (`audio/mpeg`,
  not JSON). `?stahnout=1` returns it as a downloadable attachment.
  Recordings are kept for 90 days, after that it's a 410
  `recording_expired`; a call with no recording returns 404 `no_recording`.

Both the list and the detail also carry `kind` (`agent`, `bridge`, `relay`,
`inbound`, `transfer`), `answeredBy`, `endReason`, `data` and
`hasRecording`.

```bash
curl -X POST https://volai.cz/v1/calls \
  -H "Authorization: Bearer vk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to": "+420777123456", "agentId": "ag_kx91fa2b3mnp"}'
```

```json
{
  "id": "c_8f2ac1d4x7qz",
  "status": "initiated"
}
```

**Trial call with no number of your own** (`systemPrompt` instead of
`agentId`/`from`): a single request, no need to buy a number or set up an
agent. Calls from a shared volai demo number, the response also carries
`trial: true` and `from` (the demo number). Limits: `systemPrompt` at
most 1200 characters, optional `firstMessage` at most 300 characters,
`ringingTimeoutSecs` only 5-30 (default 25, 5-60 for the other variants),
`voiceId` cannot be sent. At most 3 calls/24h per account plus a shared
cap across all accounts; verified email required. Billed completely
normally including the agent surcharge - no discount. If trial calls are
temporarily disabled (an operational switch), it returns a clear
`trial_calls_disabled` error instead of a call - in that case, call
through your own agent (`agentId`).

### Voices

- `GET /v1/voices` - voice catalog for the agent `voiceId` field.
  Currently a single entry (the template's default voice), more will be
  added over time. `voiceId` accepts both the catalog `id` and the raw
  ElevenLabs id (backward compatibility).

### Agents

- `GET /v1/agents` - list of agents
- `GET /v1/agents/{id}` - agent detail
- `POST /v1/agents` - creates an agent (`name`, `systemPrompt` required)
- `PATCH /v1/agents/{id}` - updates an agent
- `DELETE /v1/agents/{id}` - deletes an agent
- `POST /v1/agents/{id}/test-call` - a "call me from my own agent" test
  call. It's a regular billed call, just with its own cap of 3 per day per
  account. For more, use `POST /v1/calls`.

Besides `name`, `systemPrompt`, `firstMessage`, `language`, `voiceId` and
`numberE164`, both `POST` and `PATCH` take four fields from the tools and
recordings wave:

- `toolIds` - ids of the webhook tools the agent may call (at most 10),
- `transferTo` - an E.164 number to transfer to a human (an empty string
  turns transfer off; it must not be your own volai number -
  `transfer_loop`), `transferCondition` - when it should transfer,
- `dataFields` - what the agent records from the call: an array of
  `{key, type, description, enumValues}` objects, at most 10; the result
  comes back in the call's `data`,
- `recordCalls` - whether to record the agent's calls (default `true`).

### Agent tools (webhook tools)

Your API's address, which the agent calls mid-call and uses the response
in speech. A tool belongs to the account; it gets assigned to an agent via
`toolIds`.

- `GET /v1/tools` - list of tools
- `POST /v1/tools` - creates a tool: `label` (a readable name, the model's
  name for it is derived from it), `description` (when the agent should
  use it, 10 to 1000 characters), `url` (`https` only, not into an internal
  network), `method` (`GET` or `POST`), optionally `headers` (at most 5),
  `params` (at most 10) and `timeoutSecs` (5 to 30, default 20)
- `GET /v1/tools/{id}` - tool detail
- `PATCH /v1/tools/{id}` - update, all fields optional
- `DELETE /v1/tools/{id}` - deletes the tool and returns the `agents` it
  stopped working for

Each parameter in `params` has a `name`, `type` (`string` / `number` /
`boolean`) and `source`: `llm` (the model fills the value in - set
`description`, optionally `required`), `caller_number` and
`called_number` (the calling and called number in E.164, the model never
sees them), `constant` (a fixed value in `constantValue`).

```bash
curl -X POST https://volai.cz/v1/tools \
  -H "Authorization: Bearer vk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Check order",
    "description": "Looks up an order status. Use when the caller asks where their order is.",
    "url": "https://api.yourapp.com/orders",
    "method": "POST",
    "headers": {"Authorization": "Bearer your_key"},
    "params": [
      {"name": "order_number", "type": "string", "source": "llm", "description": "The order number the caller read out.", "required": true},
      {"name": "phone", "type": "string", "source": "caller_number"}
    ],
    "timeoutSecs": 20
  }'
```

Header values always come back masked (`"Bear***"`). Sending back that
exact masked value in a `PATCH` is treated as "keep the original" - so
you can't destroy the key by accident.

### Relay - bring your own (BYO) agent

For an agent running on another platform (ElevenLabs, Asterisk...) - no
agent surcharge, you pay your own platform directly for that. Guide at
`/en/docs/bring-your-own-agent`.

- `POST /v1/relay` - creates a one-time lease. `to` is the destination,
  `from` is your volai number. The returned `sipName` is a BARE name for
  ElevenLabs `to_number` - ElevenLabs rejects a full `sipUri`. Optional
  `ttlSecs` (15 to 300, default 120).
- `GET /v1/relay` - lists leases (`pending` waits for the first call,
  `active` means a call is running)
- `DELETE /v1/relay/{id}` - returns an unused (pending) lease to the pool.
  Doesn't end a call in progress - no API can do that today.

### Do-not-call list (DNC)

Numbers an agent (yours or the built-in one) must not call - whether via
`POST /v1/calls`, a test call, or relay.

- `GET /v1/dnc` - list of numbers
- `POST /v1/dnc` - adds a number
- `DELETE /v1/dnc/{e164}` - removes a number

### Webhook

- `GET /v1/webhook` - current settings (without the secret)
- `PUT /v1/webhook` - sets the URL and subscribed events, returns the
  signing `secret` (returned only once). An empty `url` removes the
  webhook.

## Idempotency

The write endpoints `POST /v1/calls`, `POST /v1/messages`,
`POST /v1/numbers`, `POST /v1/agents`, `POST /v1/tools`, `POST /v1/relay` and
`POST /v1/agents/{id}/test-call` accept an `Idempotency-Key` header.
Retrying with the same value doesn't perform the action twice and returns
the original response for 24 hours - useful for safely retrying after a
network failure. Feel free to use an order id from your own app.

## Rate limits

60 requests per minute per API key, shared between REST and MCP (they run
on the same key). Exceeding it returns 429 with a `Retry-After` header.
`POST /v1/messages` has an additional cap of its own: at most one SMS
every 2 seconds and 100 SMS per day per account.

Outgoing calls (`POST /v1/calls`, relay and the trial call) share their own
cap: 10 calls per minute and 200 per day per account, with at most 2
built-in agent calls running concurrently.

## Pagination

`GET /v1/messages` and `GET /v1/calls` take `limit` (max records) and
`before` (ms timestamp - returns only older records). For the next page,
pass the timestamp of the last record from the previous page as `before`.

## Webhooks

Five events:

- `call.completed` - the call finished. Agent calls also carry
  `transcript`, `summary` and `data` (values recorded per the agent's
  `dataFields`; the key is missing from the body when the agent collects
  nothing).
- `call.failed` - the platform rejected the call outright, or the network
  failed.
- `call.no_answer` - the called party didn't pick up an outbound call.
- `call.missed` - an inbound call went unanswered.
- `message.sent` - the SMS was sent successfully.

The payload carries a `Volai-Signature` header shaped
`t=<unix time>,v1=<HMAC SHA-256 hex>` signed over `"${t}.${rawBody}"` with
your `secret` from `PUT /v1/webhook`. Verification and examples in
TypeScript and Python are at `/en/docs/webhooks`.

## Rates

Current rates at https://volai.cz/en/pricing. Roughly:

- Outbound call: 0.92 CZK/min
- Inbound call: 0.50 CZK/min
- SMS: 1.36 CZK/segment
- Phone number: 25.00 CZK/month
- Voice agent: 2.50 CZK/min on top of the call price

Rates and credit are quoted excluding VAT - 21% VAT is added only at
payment time, when topping up credit in the portal. Billed by the second,
not rounded up to whole minutes. Credit never expires, no plans or custom
packages.

## Typical flows

1. **A trial call with no number of your own.** `make_call` (or
   `POST /v1/calls`) with `systemPrompt` instead of `agentId`/`from` ->
   calls right away from a shared volai demo number, no number purchase
   or agent setup needed -> `get_call` with `waitSecs` (e.g. 30) waits for
   it to finish and returns `transcript` and `summary` right away, no
   polling. Billed normally, daily limit 3 calls per account.
2. **Buy a number and set up an agent.** `buy_number` (or
   `POST /v1/numbers`) -> `create_agent` with a name, `systemPrompt` and
   `numberE164` from the previous step right away (one tool creates the
   agent and attaches the number at once). Use `set_number_routing`
   (`PATCH /v1/numbers/{e164}`) only when the number already has an agent
   and you want to switch it to different routing or a different agent.
3. **A number from a region outside the standard offer.**
   `find_number_address` with `query` (the whole address in one call), or
   step by step down to `cp`, until `recap` appears -> `order_number_from_region`
   with the codes from there -> `list_number_orders` for status.
4. **Send an SMS.** `send_sms` (or `POST /v1/messages`) with `to` and
   `body` - a custom sender name isn't supported, sign your name directly
   in the text.
5. **Make a call with your own agent and read the transcript.** `make_call`
   with `agentId` -> `get_call` with `waitSecs` waits for the call to
   finish and returns `transcript` (an array of turns) and `summary` right
   away, no polling.
6. **A custom agent on another platform.** `create_relay_lease` with
   `from` (your volai number) and `to` (the destination) -> use the
   returned `sipName` in your platform as the destination number ->
   `list_relay_leases` / `cancel_relay_lease`.
7. **Block a number.** `add_to_dnc` -> the built-in agent and relay then
   both refuse it. With your own agent outside relay, you have to check
   `list_dnc` yourself.
8. **Give the agent a tool.** `create_tool` (or `POST /v1/tools`) -> send
   the returned `id` in `toolIds` to `update_agent` -> tell the agent in
   `systemPrompt` when to use it. Creating the tool alone doesn't change
   any agent.
9. **Record something from a call and listen back to it.** `update_agent`
   with `dataFields` -> after the call, the filled-in `data` arrives in
   `get_call` and in the `call.completed` webhook -> download the audio
   from `GET /v1/calls/{id}/recording` (90 days from the call).

## Errors

A failure always has the same shape:

```json
{
  "error": {
    "code": "insufficient_credit",
    "message": "Insufficient credit. Top up at /en/credit."
  }
}
```

Common codes: `unauthorized` (401, key missing or invalid),
`insufficient_credit` (402, not enough credit left on the account),
`rate_limited` (429, 60 requests/min per key - shared between MCP and
REST, wait per `Retry-After`), `internal_error` (500, try again). A few
actions can return 502 (an upstream provider error) or 503 (temporarily
unavailable). Endpoint-specific field and error codes (`invalid_number`,
`agent_not_found`, `on_dnc`, `capacity_busy`, `not_found`...) are listed
per endpoint at `/en/docs/api`.

MCP responses have no HTTP status - a caller detects failure from
`isError: true` and an English message that says what to do.

---
name: volai
description: Czech telephony API and MCP for apps and AI agents - numbers, calls, SMS, voice agent. Use when the user wants phone calls, SMS or a voice agent in their app.
---

# volai

Czech Twilio for vibe coders. One API and one MCP server for phone
numbers, calls, SMS and a voice AI agent. Prices in Czech crowns and
hellers, no contract, billed by the second.

## What volai is

volai buys a phone number - Czech (Prague, Brno, nomadic 910) or Slovak
(Bratislava) - can call from and to it, send SMS, and attach a voice AI
agent to it. An agent runs on one of two platforms, reported read-only in
its `provider` field: `engine` (volai's own engine, Cartesia voices from
the volai catalog) or `elevenlabs` (voice `anet` or a raw ElevenLabs
voice id). At creation, `useForOutboundTasks: true` explicitly selects the engine,
`false` selects the ElevenLabs creation path, and omitting it uses the
deployment default. A configured `transferTo` can then switch an ElevenLabs
agent to the engine. Always read `provider` and `voiceId` back after creation
or an update; do not infer them from the choice of client or a voice name.
An engine catalog voice such as `milena` is rejected on an ElevenLabs agent.

- **MCP server** is recommended for AI assistants (Claude Code, Cursor,
  Windsurf and VS Code).
- **REST API v1** is a good fit for your own backend and also exposes the
  actions intentionally unavailable as MCP tools.

Both interfaces share an account and public record
shapes. The capability table below lists every supported action and the
intentional differences. Number release, integration connection/disconnection,
CSV preview and binary downloads are REST/portal operations, not MCP tools.
Use `get_call` for recording availability, then fetch the audio over REST.
Single agent, message and webhook-tool reads use the corresponding list tool
in MCP. Credit top-up tax documents ARE available through
`list_billing_documents` / `get_billing_document` and
`GET /v1/billing/documents`; the PDF download is REST-only. These are
separate from invoices read from connected Fakturoid or ABRA Flexi accounts.
Billing details are readable in `GET /v1/account` and writable through
`PUT /v1/account/billing` or `update_billing_details`.

## Authentication

MCP supports OAuth sign-in and existing API keys. Add
`https://volai.cz/mcp` in Codex, Claude or another OAuth MCP client and
complete the browser sign-in and explicit consent. The client discovers
`/.well-known/oauth-protected-resource/mcp` and
`/.well-known/oauth-authorization-server`, registers through DCR, and uses
authorization code + PKCE S256. The resource is exactly
`https://volai.cz/mcp`. Scope `volai` grants the existing full MCP access,
including account data, sensitive SIP settings, edits, calls, SMS and
number orders. Request `offline_access` for rotating refresh tokens, and
`openid email` for OIDC identity. Access tokens last 10 minutes, refresh
tokens up to 30 days and consent up to 90 days. Users revoke connections
in `/en/api-and-mcp`; password changes also invalidate OAuth access.
OAuth tokens do not authenticate REST requests.

In Claude Code: `claude mcp add --transport http volai https://volai.cz/mcp`,
then authenticate in `/mcp`. Official directory listing requires separate
provider approval; a direct MCP connection or the project marketplace
does not imply that approval.

The API key alternative works for both MCP and REST:

```
Authorization: Bearer vk_YOUR_KEY
```

Open **AI assistant** in the portal (`/en/api-and-mcp`), select your client,
and choose **Create access for your assistant**. The generated configuration
contains your key, which is shown only once. The advanced section on the
same page manages keys, REST examples and webhooks. Signing up is at
`/en/auth/signup`.

Creating a key is portal-only: an API key cannot mint another key. REST
`DELETE /v1/api-keys/{id}` can revoke only the key authenticating that
request; other keys must be revoked in the portal. MCP has no revoke tool.
Successful revocation immediately invalidates the key, including MCP access.

## Base URL

```
https://volai.cz
```

## Conventions

- **Phone numbers are always E.164** with a country code: `+420777123456`.
- **volai prices are in hellers** (1/100 CZK, the `*Hal` fields), some responses also include
  crowns (`*Czk`). Connected invoice `amountDueMinor` uses its stated currency. Never round it yourself.
- **Timestamps are unix milliseconds** (`createdAt`, `startedAt`, `boughtAt`,
  `issuedAt`, `taxableAt`) EXCEPT the connected-calendar AND connected-invoice
  fields, which follow the provider's own format: `start`, `end`, `fetchedAt`
  (calendar) and the query parameters `timeMin`/`timeMax` are RFC 3339
  strings (`2026-09-08T10:00:00.000Z`), never a number; `GET
  /v1/integrations/{id}/invoices` and `.../invoices/{externalId}` are
  strings too - `fetchedAt` is the same RFC 3339 shape, `dueDate` is a plain
  date (`2026-09-08`) straight from Fakturoid/ABRA Flexi, or `null` when the
  provider didn't give one.
- **Identifiers carry a prefix that names the resource** and are otherwise
  opaque (don't parse them further): `vk_` API key, `ag_` agent, `ad_` agent
  draft, `ado_` draft operation, `c_` call, `msg_` SMS message, `tl_` tool,
  `whd_` webhook delivery, `rl_` relay lease, `int_` connected integration,
  `inv_` tax document (`GET /v1/billing/documents`), `l_` credit ledger
  entry, `task_` outbound task, `item_` task recipient, `attempt_` a call
  attempt on a task item, `req_` request id (see Errors below).
- **Three pagination schemes, plus lists with none.** `GET /v1/messages`,
  `GET /v1/calls` and `GET /v1/billing/documents` take `limit` + `before` (a
  Unix ms timestamp, exclusive) and answer with `hasMore`/`nextBefore` - see
  Pagination below. Connected-calendar events (`GET
  /v1/integrations/{id}/events`) use an opaque `pageToken`/`nextPageToken`
  instead - keep `timeMin`/`timeMax`/`search` unchanged between pages,
  `pageToken` alone doesn't. `GET /v1/credit/ledger` takes only `limit`
  (1-200, default 50), no cursor at all - it always starts from the most
  recent entry. `GET /v1/tasks` has no cursor either and returns at most
  the 100 most recent tasks. `GET /v1/webhook/deliveries` also has no
  cursor and returns at most the last 20 deliveries (successful, failed
  and test ones). Connected-invoice search silently caps out too - the
  first 40 Fakturoid or 50 ABRA Flexi rows, with no cursor to see more;
  narrow the search instead. Everything else that returns a list (agents,
  numbers, tools, API keys, DNC, voices) returns the full set in one
  response; there is nothing to page through.
- **An unknown query parameter is ignored** almost everywhere (so a stale
  client doesn't break by sending one) - the exceptions are the
  connected-calendar and connected-invoice endpoints
  (`/v1/integrations/{id}/...`), which reject an unknown parameter with 400
  `validation` because they forward query state to the upstream provider and
  a silently-dropped filter there would look like missing data, not an
  error; and, for an unrelated reason, `GET /v1/credit/ledger` and `GET
  /v1/billing/documents`, whose query schemas are strict on purpose so a
  typo in `limit`/`before` fails loudly instead of being silently ignored.
- **A handful of fields intentionally keep Czech names.** The number address
  flow (`GET /v1/numbers/address-options`, then `POST /v1/numbers/orders` -
  plain `POST /v1/numbers` only takes `e164`/`region` and ignores an
  address) passes `psc`, `obec`, `cobce`, `ulice` (only where the address
  has a street) and `cp` - the exact field names of the RÚIAN registry (the
  operator's own address code list) the number is ordered from, so a value
  round-tripped from one to the other is never silently mistranslated. `GET
  /v1/calls/{id}/recording?stahnout=1` is the one query parameter with a
  Czech name outside that flow (download as an attachment instead of
  inline). Every other identifier, field and parameter in REST and MCP is
  English.
- **Quotas, gathered in one place** (the endpoint-specific ones are repeated
  next to that endpoint above; this is the full list): 60 requests/min per
  API key (REST and MCP share it, see Rate limits below); SMS 1 every 2 s
  and 100/day per account; outbound calls (agent, bridge, trial) 10/min and
  200/day per account with at most 2 built-in-agent calls running at once;
  a trial call with no number of your own (`POST /v1/calls` with
  `systemPrompt` instead of `agentId`/`from`) additionally caps at 3/24h
  per account AND a shared 30/hour across ALL accounts combined - the
  shared cap can return 429 with no fault of your own account; `POST
  /v1/agents/{id}/test-call` 3/day per account; `POST
  /v1/tools/test`/`.../{id}/test` 10/min per account; `POST
  /v1/agents/{id}/simulate` 20/hour per account; `POST /v1/webhook/test`
  10/hour per account; `GET /v1/changelog` 30/min per IP (it takes no API
  key); a `running` outbound task dials at most ONE recipient per cron tick
  (`*/2 * * * *`), and the tick itself checks at most 20 tasks across ALL
  accounts combined - so even with credit and an open calling window, calls
  from one task land roughly two minutes apart, and a busy platform (more
  than 20 tasks running at once) rotates fairly between tasks rather than
  finishing one before starting the next.
- **Webhook deliveries retry within the same request, not later.** A
  failed delivery gets up to 3 attempts, 3 seconds apart, all before
  `dispatchEvent` returns - if your endpoint is still down after that,
  volai gives up on that event for good; nothing re-delivers it minutes or
  hours afterward. Check `GET /v1/webhook/deliveries` (or
  `list_webhook_deliveries`) after an incident instead of assuming a retry
  is still coming, and design the endpoint to come back quickly rather than
  to eventually catch up.
- **v1 only ever adds.** An existing field never disappears, changes type
  or changes meaning (see Versioning below for the full rule). volai
  hasn't FULLY retired a v1 field yet; when it eventually does, the field is
  marked `deprecated: true` in `GET /openapi.json` and the response
  carries `Deprecation`/`Sunset` headers at least 90 days before removal,
  and an MCP tool response that touches it gets a `warnings` entry (the
  same `structuredContent.warnings` array already used for the agent
  AI-disclosure warning) - removal itself only ever ships as a new major
  version (`v2`), never silently inside v1. The one exception is 1.5.1,
  which stopped returning `answeredBy` for inbound calls - there the
  field never had a meaningful value (a brief caller reply is not a
  voicemail); it is unchanged for outbound calls.
- **Calls vs. conversations** - `GET /v1/calls` returns one row per call
  LEG, not per phone conversation; a transferred call is two rows via the
  API but one row in the portal's `/hovory` table. See "Calls vs.
  conversations" under Calls below before summing counts.
- **A credential (password, API token, app-specific password) is passed
  only if the user already put it somewhere you can read** - an env
  variable or a file they named. Never ask for one in conversation, never
  echo it back; applies today to Apple Calendar and ABRA Flexi (see
  "Google and Apple Calendar" and "Fakturoid and ABRA Flexi invoices"
  below).
- **A call, SMS or number purchase costs real money** and cannot be
  reversed. Don't retry a failed action "just in case" - use
  `Idempotency-Key` instead.
- **Money only moves with a human at the card.** `POST /v1/credit/topup`
  (MCP `create_topup_link`) returns a Stripe Checkout link for a fixed
  amount - nothing is charged until the customer pays it themselves.
  `POST /v1/credit/auto-topup/setup` also only returns a Checkout link,
  even when a card is already saved; completing it is what actually turns
  automatic top-up on and takes the first charge - the API itself never
  charges a card or turns auto top-up on by itself. Over the REST API,
  `PATCH /v1/credit/auto-topup` can turn it off and/or change its
  threshold without a new charge; MCP `disable_auto_topup` only turns it
  off (no arguments) - changing the threshold over MCP isn't possible,
  use the REST `PATCH` or the portal instead. Turning it on, or changing
  its amount, always goes back through that setup Checkout link instead,
  in the portal at `/en/credit` or via `POST
  /v1/credit/auto-topup/setup` (REST/portal-only, like turning it on -
  MCP deliberately has no tool for it, see "What MCP intentionally
  doesn't have" below).
- **Every v1 response carries `x-volai-version`** (success, error, 429,
  binary routes, `/openapi.json`) with the current interface version. If
  it differs from the last version you saw, call `GET /v1/changelog` (or
  MCP `get_changelog`) to see what's new.

## Capabilities

Every customer-facing capability with its portal page, REST endpoints, MCP tools and guide; generated from lib/capabilities.ts - do not edit by hand.

### Account

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Account profile | `GET /v1/account` | `get_account` | - |
| Update profile | `PATCH /v1/account` | `update_account` | - |
| Billing details | `PUT /v1/account/billing` | `update_billing_details` | - |
| List API keys | `GET /v1/api-keys` | `list_api_keys` | - |
| Revoke an API key | `DELETE /v1/api-keys/{id}` | - (Revoking someone else's key over API/MCP would let a stolen key cut off every other integration on the account while staying active itself) | - |
| Create an API key | - (A key that mints keys turns the leak of one key into a permanent foothold - bootstrapping a key therefore stays in the portal only, one click away from onboarding (owner's decision, spec §3).) | - (A key that mints keys turns the leak of one key into a permanent foothold) | - |
| Set email notifications | - (lowCredit is the only brake between "credit is running out" and silent exhaustion; a stolen key or prompt injection could switch it off - writes therefore stay in the portal only, REST exposes notification settings read-only via GET /v1/account (spec §3).) | - (lowCredit is the only brake between "credit is running out" and silent exhaustion; a stolen key or prompt injection could switch it off) | - |
| Delete account | - (Self-service account deletion is not offered even in the portal - the page only links to support (mailto:podpora@volai.cz); deletion is a manual operator procedure (spec §3).) | - (Self-service account deletion is not offered even in the portal) | - |

### Connections

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List integrations | `GET /v1/integrations` | `list_integrations` | `/en/docs/connections` |
| Connect an integration | `POST /v1/integrations` | - (A password is not passed through an MCP conversation - only into a one-off REST request called from a script or terminal the user controls) | `/en/docs/connections` |
| Disconnect an integration | `DELETE /v1/integrations/{id}` | - (Irreversible, or requires a new human step (credentials or OAuth in a browser) - spec §3) | `/en/docs/connections` |

### Invoices

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List invoices | `GET /v1/integrations/{id}/invoices` | `list_invoices` | `/en/docs/invoices` |
| Read one invoice | `GET /v1/integrations/{id}/invoices/{invoiceId}` | `get_invoice` | `/en/docs/invoices` |

### Calendars

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List calendars | `GET /v1/integrations/{id}/calendars` | `list_calendars` | `/en/docs/connections` |
| List calendar events | `GET /v1/integrations/{id}/events` | `list_calendar_events` | `/en/docs/connections` |
| Read a calendar event | `GET /v1/integrations/{id}/events/{eventId}` | `get_calendar_event` | `/en/docs/connections` |
| Propose a calendar change | `POST /v1/integrations/{id}/events/{eventId}/propose` | `propose_calendar_update` | `/en/docs/connections` |
| Confirm a calendar change | `PATCH /v1/integrations/{id}/events/{eventId}` | `confirm_calendar_update` | `/en/docs/connections` |

### Balance

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Get balance | `GET /v1/balance` | `get_balance` | - |

### Numbers

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Get phone number detail | `GET /v1/numbers/{e164}` | `get_number` | - |
| List phone numbers | `GET /v1/numbers` | `list_numbers` | - |
| Search available numbers | `GET /v1/numbers/available` | `search_available_numbers` | - |
| Buy a phone number | `POST /v1/numbers` | `buy_number` | - |
| Find an address for a number order | `GET /v1/numbers/address-options` | `find_number_address` | - |
| Order a number from another region | `POST /v1/numbers/orders` | `order_number_from_region` | - |
| List number orders | `GET /v1/numbers/orders` | `list_number_orders` | - |
| Set number routing | `PATCH /v1/numbers/{e164}` | `set_number_routing` | - |
| SIP credentials | `GET /v1/numbers/{e164}/sip` | `get_sip_credentials` | - |
| SIP registration status | `GET /v1/numbers/{e164}/sip/status` | `get_sip_status` | - |
| Join a number waitlist | `POST /v1/numbers/waitlist` | `join_number_waitlist` | - |
| Leave a number waitlist | `DELETE /v1/numbers/waitlist/{offerId}` | `leave_number_waitlist` | - |
| List waitlist offers | `GET /v1/numbers/waitlist` | - (join_number_waitlist is itself idempotent) | - |
| Release a phone number | `DELETE /v1/numbers/{e164}` | - (Irreversible - the number returns to the pool and this account cannot reclaim it) | - |

### SMS

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Send an SMS | `POST /v1/messages` | `send_sms` | - |
| List sent SMS messages | `GET /v1/messages` | `list_messages` | - |
| Get one SMS message | `GET /v1/messages/{id}` | - (list_messages already returns the full message body per row - a separate single-read tool adds nothing) | - |

### Calls

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Place a call | `POST /v1/calls` | `make_call` | - |
| List calls | `GET /v1/calls` | `list_calls` | - |
| Get call details | `GET /v1/calls/{id}` | `get_call` | - |
| Annotate a call | `PATCH /v1/calls/{id}` | `annotate_call` | - |
| Download a call recording | `GET /v1/calls/{id}/recording` | - (Binary audio - an MCP tool result cannot usefully carry it) | - |
| Call statistics | - (Derived from the call list: the same data comes from GET /v1/calls with filters (period, agent, outcome, destination, tag) - a dedicated endpoint would only duplicate it (spec §3).) | - (Derived from the call list: the same data comes from GET /v1/calls with filters (period, agent, outcome, destination, tag)) | - |
| Export calls to CSV | - (Derived from the call list: the same data comes from GET /v1/calls with filters (period, agent, outcome, destination, tag) - a dedicated endpoint would only duplicate it (spec §3).) | - (Derived from the call list: the same data comes from GET /v1/calls with filters (period, agent, outcome, destination, tag)) | - |

### Voices

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Voice catalog | `GET /v1/voices` | `list_voices` | - |

### Agents

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Create a voice agent | `POST /v1/agents` | `create_agent` | `/en/docs/agent` |
| List voice agents | `GET /v1/agents` | `list_agents` | `/en/docs/agent` |
| Get one voice agent | `GET /v1/agents/{id}` | - (list_agents already returns the full agent detail per row - a separate single-read tool adds nothing) | `/en/docs/agent` |
| Update a voice agent | `PATCH /v1/agents/{id}` | `update_agent` | `/en/docs/agent` |
| Delete a voice agent | `DELETE /v1/agents/{id}` | `delete_agent` | `/en/docs/agent` |
| Test call | `POST /v1/agents/{id}/test-call` | `test_call` | `/en/docs/agent` |
| Switch agent provider | - (Provider selection is available at creation via useForOutboundTasks (omission uses the deployment default); transferTo may switch an agent to the engine - switching an EXISTING agent's provider stays a manual admin action, not exposed to the customer (owner's decision, spec §3).) | - (Provider selection is available at creation via useForOutboundTasks (omission uses the deployment default); transferTo may switch an agent to the engine) | `/en/docs/agent` |

### Agent drafts

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Agent draft | `GET /v1/agents/{id}/draft` | `get_agent_draft` | `/en/docs/agent` |
| Save agent draft | `PUT /v1/agents/{id}/draft` | `save_agent_draft` | `/en/docs/agent` |
| Publish agent draft | `POST /v1/agents/{id}/draft/publish` | `publish_agent_draft` | `/en/docs/agent` |
| Roll back agent draft | `POST /v1/agents/{id}/draft/rollback` | `rollback_agent_draft` | `/en/docs/agent` |
| Reconcile draft operation | `POST /v1/agents/{id}/draft/operation` | `reconcile_agent_draft_operation` | `/en/docs/agent` |
| Read a draft operation | `GET /v1/agents/{id}/draft/operation` | - (get_agent_draft already returns the same operation field; reconcile_agent_draft_operation resolves it directly) | `/en/docs/agent` |
| Simulate agent draft | `POST /v1/agents/{id}/simulate` | `simulate_agent_draft` | `/en/docs/agent` |

### Tools

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List agent tools | `GET /v1/tools` | `list_tools` | - |
| Get one agent tool | `GET /v1/tools/{id}` | - (list_tools already returns the full tool detail, including which agents use it, per row - a separate single-read tool adds nothing) | - |
| Create an agent tool | `POST /v1/tools` | `create_tool` | - |
| Update an agent tool | `PATCH /v1/tools/{id}` | `update_tool` | - |
| Delete an agent tool | `DELETE /v1/tools/{id}` | `delete_tool` | - |
| Test a webhook tool | `POST /v1/tools/test`, `POST /v1/tools/{id}/test` | `test_tool` | - |

### Webhooks

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Get webhook settings | `GET /v1/webhook` | `get_webhook` | `/en/docs/webhooks` |
| Set or remove the webhook | `PUT /v1/webhook` | `set_webhook` | `/en/docs/webhooks` |
| Remove the webhook | `DELETE /v1/webhook` | `remove_webhook` | `/en/docs/webhooks` |
| Send a test webhook event | `POST /v1/webhook/test` | `send_test_webhook` | `/en/docs/webhooks` |
| List webhook deliveries | `GET /v1/webhook/deliveries` | `list_webhook_deliveries` | `/en/docs/webhooks` |

### Relay

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Create a relay lease | `POST /v1/relay` | `create_relay_lease` | - |
| List relay leases | `GET /v1/relay` | `list_relay_leases` | - |
| Cancel a relay lease | `DELETE /v1/relay/{id}` | `cancel_relay_lease` | - |

### DNC

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List the do-not-call list | `GET /v1/dnc` | `list_dnc` | - |
| Add to the do-not-call list | `POST /v1/dnc` | `add_to_dnc` | - |
| Remove from the do-not-call list | `DELETE /v1/dnc/{e164}` | `remove_from_dnc` | - |
| Unblock a destination | `POST /v1/dnc/{e164}/unblock` | `unblock_destination` | - |

### Changelog

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Changelog | `GET /v1/changelog` | `get_changelog` | - |

### Tasks

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List tasks | `GET /v1/tasks` | `list_tasks` | `/en/docs/tasks` |
| Create a task | `POST /v1/tasks` | `create_task` | `/en/docs/tasks` |
| Task detail | `GET /v1/tasks/{id}` | `get_task` | `/en/docs/tasks` |
| Update a task | `PATCH /v1/tasks/{id}` | `update_task` | `/en/docs/tasks` |
| Start a task | `POST /v1/tasks/{id}/start` | `start_task` | `/en/docs/tasks` |
| Pause a task | `POST /v1/tasks/{id}/pause` | `pause_task` | `/en/docs/tasks` |
| Resolve a contact waiting for review | `POST /v1/tasks/{id}/items/{itemId}/resolve` | `resolve_task_item` | `/en/docs/tasks` |
| Reconcile a task | `POST /v1/tasks/{id}/reconcile` | `reconcile_task` | `/en/docs/tasks` |
| Delete a task | `DELETE /v1/tasks/{id}` | - (Irreversible (spec §8 "Delete an unstarted task" - REST and the portal with type-to-confirm only); MCP does not have this action) | `/en/docs/tasks` |
| Preview a recipients CSV | `POST /v1/tasks/csv-preview` | - (A form helper before creating a task (validating rows of an uploaded file, not an action on a task)) | `/en/docs/tasks` |

### Credit

| Capability | REST | MCP | Guide |
|---|---|---|---|
| Credit ledger | `GET /v1/credit/ledger` | `list_ledger` | `/en/docs/credit` |
| Top up credit by card | `POST /v1/credit/topup` | `create_topup_link` | `/en/docs/credit` |
| Auto top-up settings | `GET /v1/credit/auto-topup` | `get_auto_topup` | `/en/docs/credit` |
| Update auto top-up | `PATCH /v1/credit/auto-topup` | `disable_auto_topup` | `/en/docs/credit` |
| Turn on auto top-up | `POST /v1/credit/auto-topup/setup` | - (Turning it on (and changing the amount) only goes through a Stripe Checkout URL with a human at the card (spec §2 "Money only moves with a human at the card", §3, §8); MCP only gets reading and turning it off (disable_auto_topup)) | `/en/docs/credit` |
| Change the auto top-up card | `POST /v1/credit/auto-topup/card` | - (Changing the saved card goes through Stripe Checkout (a new human step at the card)) | `/en/docs/credit` |
| Remove the auto top-up card | `DELETE /v1/credit/auto-topup/card` | - (REST-only (spec §3 "disconnecting the card in MCP" - no): removing the card is an irreversible step after which auto top-up stops working entirely until a card is reconnected through Checkout) | `/en/docs/credit` |

### Billing documents

| Capability | REST | MCP | Guide |
|---|---|---|---|
| List billing documents | `GET /v1/billing/documents` | `list_billing_documents` | `/en/docs/credit` |
| Billing document detail | `GET /v1/billing/documents/{id}` | `get_billing_document` | `/en/docs/credit` |
| Billing document PDF | `GET /v1/billing/documents/{id}/pdf` | - (Binary PDF - an MCP tool result cannot usefully carry it, same as calls.get_recording) | `/en/docs/credit` |

## MCP server

Install into Claude Code (similarly Cursor, Windsurf - `http` transport):

```bash
claude mcp add --header 'Authorization: Bearer vk_YOUR_KEY' --transport http --scope user volai 'https://volai.cz/mcp'
```

Every tool goes over the same service layer as the REST API:

| Tool | What it does |
|---|---|
| `get_account` | Read the account profile - name, email language, billing address, company details and DIC verification status. Notification switches are read-only here; change them in the portal. |
| `update_account` | Change the account's name or language (emails and invoices) - the language of REST/MCP responses is always English regardless. |
| `update_billing_details` | Update billing address or company details (Company ID, DIC) - a foreign DIC gets verified against the VIES registry, which can switch the account onto reverse-charge VAT and change the price of the next top-up. |
| `list_api_keys` | List the account's API keys. Creating a new key is portal-only; revoking another key is too - a key must never be able to invalidate the rest of the account's keys. |
| `list_integrations` | List owned connections, provider setup readiness and browser URLs. Sign in to volai and authorize the provider in the browser; ready indicates server configuration, not a verified account connection. |
| `list_invoices` | Search issued Fakturoid or ABRA Flexi invoices; first 40 or 50 matches respectively. Refine the search when needed. |
| `get_invoice` | Read fresh invoice status, outstanding balance and provider evidence. Unknown or missing values never prove payment. |
| `list_calendars` | List calendars on a connected account, including timezone and access role. |
| `list_calendar_events` | List Google events or Apple events and recurring series, with search, time bounds and pagination in batches of 50. |
| `get_calendar_event` | Read the current event and its sourceRevision before making changes. |
| `propose_calendar_update` | Prepare a title or time change without writing. Show the original event and the proposal to the user. |
| `confirm_calendar_update` | After explicit user approval, apply the proposal and verify it with the provider. Reject stale revisions. |
| `get_balance` | Current account credit balance |
| `get_number` | Detail of one owned phone number - the same data as one item of `list_numbers`. |
| `join_number_waitlist` | Join the waitlist for a sold-out offer after `buy_number` fails with `pool_empty` - doesn't buy a number, just registers interest; an email follows once it restocks. |
| `leave_number_waitlist` | Leave the waitlist for one offer, without affecting the waitlist for any other offer. |
| `get_sip_status` | The true SIP registration status for a number routed to "your own PBX", plus its last inbound call - diagnostic, not credentials (those come from `get_sip_credentials`). |
| `list_numbers` | Phone numbers on the account, including routing |
| `search_available_numbers` | Numbers available to buy (Prague, Brno, internet 910, Slovak Bratislava) |
| `buy_number` | Buys a number - random, from a region, or a specific one from the offer; billed `monthlyFeeHal * billingMonths` per period (1 month for Czech numbers, 3 for Bratislava) |
| `find_number_address` | Operator address-registry cascade: postal code -> municipality -> part -> street -> house number (or the whole address in one `query`) |
| `order_number_from_region` | Orders a number from a region outside the standard offer (Ostrava, Plzen...) |
| `list_number_orders` | Status of out-of-region number orders |
| `set_number_routing` | Sets number routing (agent / forward / SIP / none). For SIP mode, optional `sipUsername`/`sipPassword` authenticate to the target PBX (SIP digest) - verified working against Vapi's native SIP number (challenges and accepts any credentials); whether your own PBX also connects the call is still up to it. Each of `sipUsername`/`sipPassword` keeps its stored value when you omit it, so changing only `sipUri` keeps the login; clear authentication by sending both as empty strings. Exception: if the new `sipUri` points at a different server, send `sipPassword` again - a stored password is never forwarded to a server it was not entered for. If the target never challenges the INVITE, or challenges but rejects the credentials, allow our signalling by IP instead: `81.31.45.0/24` (in practice `81.31.45.51` and `81.31.45.56`) |
| `get_sip_credentials` | SIP login credentials for a number: `server` (for your own PBX's REGISTER) and `outboundTrunkAddress` (a platform's outbound trunk, e.g. ElevenLabs `outbound_trunk_config.address`) have DIFFERENT roles - use `outboundTrunkAddress` for the trunk regardless of whether the two values match, see "Relay - bring your own (BYO) agent" below |
| `send_sms` | Sends an SMS to a Czech or Slovak number (up to 765 characters) |
| `list_messages` | History of sent SMS |
| `make_call` | Starts an outbound call (via an agent, a plain bridge between two numbers, or a trial call with no number of your own) |
| `list_calls` | Call history (inbound and outbound); optional `direction` (`in`/`out`) filters it |
| `get_call` | Call detail including transcript, summary, recorded data (`data`) and whether it has a recording (`hasRecording` - the audio itself is fetched via REST, format follows its `content-type`: MP3 from ElevenLabs, OGG from the volai engine today); `waitSecs` waits for it to finish instead of polling |
| `annotate_call` | Set a note, flag with a reason, or mark a call handled/unhandled - the same three fields as the call card in the portal. |
| `list_voices` | Voice catalog for the agent `voiceId` field; `provider` argument (`elevenlabs`/`engine`) filters the list |
| `create_agent` | Creates a voice agent (name, system instructions, voice, tools, transfer, data fields, goal, knowledge); `useForOutboundTasks` selects the creation path: true requests engine, false ElevenLabs, omitted uses the deployment default; `transferTo` may then trigger an engine switch; read back `provider` and `voiceId`; `voicemail` (engine agents only) detects a voicemail on outbound calls and marks/hangs up/leaves a message |
| `list_agents` | List of voice agents on the account |
| `update_agent` | Changes the live agent immediately. If you want to review or simulate a change before it goes live, or a human may be editing the same agent in the volai portal, use `save_agent_draft` + `publish_agent_draft` instead; `update_agent` bumps the draft revision and clears the `tested` marker; includes `toolIds`, `transferTo`, `dataFields`, `recordCalls`, `goal`, `knowledge`, `notifyEmail`, `voicemail` (engine agents only, `null` clears it). If this keeps failing with `in_progress`, an uncertain provider operation is blocking the agent - resolve it with `reconcile_agent_draft_operation` (or the equivalent REST `POST /v1/agents/{id}/draft/operation`) or in the volai portal |
| `delete_agent` | Deletes an agent (a number attached to it is detached first and stays on the account) |
| `rollback_agent_draft` | Rolls the agent back to an earlier PUBLISHED revision from history and deploys it - touches the provider and telephony like `publish_agent_draft`, so never re-run blindly after an uncertain result. |
| `reconcile_agent_draft_operation` | Resolves a stuck uncertain draft operation after a human checked what is actually live - the MCP counterpart of REST `POST /v1/agents/{id}/draft/operation`. |
| `test_call` | Places a test call from an agent to a given number right now - billed the same as a regular outbound call, capped at 3 test calls per account per day across all agents. |
| `get_agent_draft` | Reads the saved draft, the published snapshot, the revision, the last simulation result (`tested`), publish history, and any operation currently blocking the agent |
| `save_agent_draft` | Saves a full draft snapshot against `expectedRevision`. Never changes the running agent; only `publish_agent_draft` does. For an immediate live change use `update_agent` |
| `publish_agent_draft` | Deploys the saved draft to the live agent - the only draft tool that touches the provider. After a timeout call `get_agent_draft` first and check `operation`; never re-publish blindly |
| `simulate_agent_draft` | Runs a text message against the SAVED draft, not the live agent; sets the `tested` marker; optional, not required to publish; not billed to the customer; 20 per hour; fixed Anthropic model, no tools, no audio |
| `list_tools` | Webhook tools on the account (header values masked); items include `agents` - who has each tool enabled. |
| `test_tool` | Sends a real test request with sample values - either a saved tool (`toolId`) or an inline definition (`url`/`method`), never both. Redirects are never followed. |
| `create_tool` | Creates a webhook tool the agent can call during a call |
| `update_tool` | Updates a tool (`params` and `headers` are always sent in full) |
| `delete_tool` | Deletes a tool and returns the agents it stopped working for |
| `remove_webhook` | Removes the webhook - volai stops sending anything. Same effect as `set_webhook` with an empty `url`, just explicit; set a new webhook again any time. |
| `list_webhook_deliveries` | The last 20 webhook deliveries (successful, failed and test ones from `send_test_webhook`) - same data as `recentDeliveries` on `get_webhook`. |
| `get_webhook` | Current webhook target, subscribed events and `recentDeliveries` (last 20 deliveries, including test events) |
| `set_webhook` | Sets the target and events; an empty `url` removes the webhook |
| `send_test_webhook` | Sends one test event (`webhook.test`) to the configured URL, regardless of the subscribed events - checks reachability, not the subscription; 10 per hour |
| `create_relay_lease` | One-time SIP slot for an outbound call by your own (BYO) agent |
| `list_relay_leases` | List of relay leases (`pending` / `active`) |
| `cancel_relay_lease` | Returns an unused lease to the pool |
| `add_to_dnc` | Adds a number to the do-not-call list |
| `list_dnc` | Lists the manual do-not-call list plus indexed automatic blocks |
| `remove_from_dnc` | Removes a number from the manual do-not-call list only |
| `unblock_destination` | Lifts an automatic block without changing the manual list |
| `get_changelog` | What changed in the API, MCP, and portal - same data as `/en/changelog`, filtered by date or version (`since`), area (`area`), and count (`limit`). Call it whenever `serverInfo.version` differs from the version the client last saw. |
| `list_tasks` | List this account's outbound tasks (bulk call campaigns), newest first. |
| `get_task` | Read one task's detail including `issues` - what blocks `start_task` right now (an empty array does not guarantee it can start; agent readiness and the calling window are checked separately). |
| `create_task` | Creates an outbound task in the `draft` state - nothing is dialled until `start_task` runs it. Accepts any active owned agent, including ElevenLabs; only `start_task` requires `provider: engine`. |
| `update_task` | Changes an editable task's calling window, attempt/duration limits or budget. Pause a running task before editing. Recipients can only be replaced before any attempt; afterwards they fail with `items_immutable`. |
| `pause_task` | Stops a running task from starting its next dial attempt - a call already in progress is not interrupted. |
| `resolve_task_item` | Retries or skips one task item in review. Unresolved provider billing keeps the reservation and call id; retry waits for settlement, and skip can still be charged later. Once blockers are resolved, remaining contacts can resume from paused; a task with only completed/skipped contacts completes. |
| `reconcile_task` | Reconciles a task's recorded status against what actually happened after a worker interruption or an uncertain provider result - safe to call any time. |
| `start_task` | Starts or resumes dialling - billed per answered call. Requires `confirmedRecipients`/`confirmedBudgetHal` to match the task's actual values, read fresh from `get_task` right before calling. |
| `list_ledger` | Lists this account's most recent credit ledger movements (top-ups, calls, SMS, number fees, refunds, adjustments), newest first. |
| `create_topup_link` | Creates a Stripe Checkout link to top up credit by a fixed `amountCzk`; nothing is charged until the customer pays. |
| `get_auto_topup` | Reads automatic top-up settings (enabled, threshold, amount, saved card). Turning it on or changing the amount is Checkout-only, not available here. |
| `disable_auto_topup` | Turns off automatic top-up. Turning it back on requires a new Checkout session. |
| `list_billing_documents` | Lists this account's own tax documents for credit top-ups (not the connected accounting system's invoices - see `list_invoices`). |
| `get_billing_document` | Reads one tax document by id. Fetching the PDF itself is REST-only (`GET /v1/billing/documents/{id}/pdf`). |

**What MCP intentionally doesn't have, and why.** The capability table
above is the complete map, including explicit exceptions. Number release,
integration connection/disconnection, card removal, CSV preview and binary
downloads use REST or the portal. Creating an API key and revoking another
key are portal-only; REST supports self-revoke. Automatic top-up setup and
configuration are available through REST/portal; enabling it or changing
its amount still requires the customer to complete Checkout.
Some single-record reads use MCP list tools instead of a separate tool.
MCP includes billable calls, SMS and number purchases, so a connection is
not permission to spend credit: obtain approval for the concrete action.

Every tool's response is a text block (a human sentence in English, a
blank line, JSON with the data) plus the same data in `structuredContent`
for clients that can consume machine-readable output. When an action
fails, the result carries `isError: true` and an English explanation.

Every tool also reports MCP annotations that a client uses to decide
whether to ask the user for confirmation:

- `readOnlyHint: true` - all `list_*` and `get_*` tools, plus
  `search_available_numbers`, `find_number_address` and
  `propose_calendar_update` (it only prepares a change, it never writes).
- `destructiveHint: true` - overwrites, operational changes and irreversible
  effects, including sending SMS, starting calls, buying numbers, updating
  or publishing agents, deletion and removing protections. Follow each
  tool’s returned annotation and obtain user approval.
- `idempotentHint: false` - billable actions (`send_sms`, `make_call`,
  `buy_number`, `order_number_from_region`, `create_agent`,
  `create_relay_lease`, `test_call`), `create_tool`, `publish_agent_draft`,
  `rollback_agent_draft`, `simulate_agent_draft`, `test_tool` and
  `send_test_webhook`. A second call sends a second message, charges a
  second amount, or (for `publish_agent_draft`/`rollback_agent_draft`/
  `simulate_agent_draft`) publishes, rolls back or simulates again against
  a provider whose previous attempt may not be confirmed yet - a client
  must never retry these on its own after a timeout.
- `save_agent_draft` is `idempotentHint: true`; the draft revision guards
  against a lost write. `send_test_webhook` is not idempotent: every call
  delivers another event to a real external endpoint.

## Guides

Prose walkthroughs beyond this file - each note says when to read it, not
just what it covers:

- **Quickstart** (`/en/docs`) - connect an assistant, verify a read-only
  request, then choose a first task. Optional SMS and call examples follow.
  Skip setup once a working connection already exists.
- **MCP server** (`/en/docs/mcp`) - installing into each client, every tool
  with when to reach for it.
- **REST API** (`/en/docs/api`) - the full endpoint reference with curl and
  response examples; read the exact section instead of guessing a shape.
- **Voice agent** (`/en/docs/agent`) - systemPrompt, languages, voices,
  tools, transfer to a human, recordings; read before writing or editing a
  systemPrompt.
- **Webhooks** (`/en/docs/webhooks`) - event payloads, signature
  verification, retries; read before building a receiving endpoint.
- **SIP** (`/en/docs/sip`) - connecting a softphone or PBX instead of the
  built-in agent or relay; read only when the customer wants their own SIP
  client.
- **Bring your own agent** (`/en/docs/bring-your-own-agent`) - routing
  calls to an external platform (ElevenLabs, Asterisk) through relay,
  without the agent surcharge; read before connecting a foreign agent.
- **Connections** (`/en/docs/connections`) - Google/Apple Calendar:
  connecting an account and the propose/confirm flow for an event edit;
  read before `list_integrations` or a calendar tool.
- **Invoices** (`/en/docs/invoices`) - Fakturoid/ABRA Flexi: connecting an
  account, reading invoices as payment evidence, and an invoice-type Task;
  read before `list_invoices`, `get_invoice` or a reminder campaign.
- **Tasks** (`/en/docs/tasks`) - outbound calling campaigns: creation, CSV
  import, statuses, budget, calling window, global throughput; read before
  `create_task` or `start_task`.
- **Credit** (`/en/docs/credit`) - balance, runway, ledger, card top-up,
  auto top-up, tax documents; read before `/v1/credit/*` or
  `/v1/billing/*`.

## REST API v1

The full reference with examples is at `/en/docs/api`; here's an overview of
every endpoint (everything JSON, prices always in hellers); the connected
calendar and invoice endpoints have their own sections at the end of this
file. The same API also has a machine-readable description at
`GET /openapi.json` (OpenAPI 3.1, no API key required) - see OpenAPI below.

### Account

- `GET /v1/account` - profile, billing address, billing/VAT details and
  email-notification status (read-only)
- `PATCH /v1/account` - changes `name` and/or `locale` (`locale` sets the
  language of emails and tax invoices, NOT the language of REST/MCP
  responses, which is always English); at least one field required
- `PUT /v1/account/billing` - sets the billing address (`street`, `city`,
  `zip` together or not at all) and company details (`company`, `ico`,
  `dic`); a missing field is left unchanged, an explicit empty string
  clears it. A foreign EU `dic` is verified against the VIES registry and
  switches the account to the reverse-charge VAT regime (no Czech VAT on
  top-ups) - this changes the price of the next top-up.
- `GET /v1/api-keys` - lists the account's API keys (`id` is only the
  first 12 characters of the key's hash, never the full key)
- `DELETE /v1/api-keys/{id}` - self-revoke only: an API key can only
  revoke ITSELF, not another key on the account, so a stolen key cannot
  cut off every other integration and stay active. Revoking any other key
  is portal-only. `POST /v1/api-keys` (creating a new key) is
  intentionally not exposed - a key that mints another key would turn one
  leak into permanent access; create one in the portal instead.

### Credit

Full guide with flow examples: `/en/docs/credit`.

- `GET /v1/balance` - account balance plus `runway` (spend-based estimate
  of how many days it lasts) and `notice` (same notice as the portal
  overview, `null` when there is none)
- `GET /v1/credit/ledger` - recent credit movements (top-ups, calls, SMS,
  number fees, refunds), most recent first, no cursor (`limit` only,
  1-200, default 50)
- `POST /v1/credit/topup` - creates a Stripe Checkout link for a one-off
  top-up (`{amountCzk}`); nothing is charged until a human completes the
  payment. Accepts `Idempotency-Key`.
- `GET /v1/credit/auto-topup` - auto top-up status (enabled, threshold,
  amount, saved card brand/last4, spend and cap for this month)
- `PATCH /v1/credit/auto-topup` - EXCLUSIVELY turns it off
  (`{"enabled": false}`) and/or changes the threshold
  (`{"thresholdHal": ...}`); sending `enabled: true` or `amountHal` instead
  returns 400 pointing at `POST /v1/credit/auto-topup/setup` - a saved card
  must never start charging without a human
- `POST /v1/credit/auto-topup/setup` - Stripe Checkout that, once
  completed, immediately charges `amountHal` as the first top-up and only
  then saves the card for future auto top-ups; the only way to turn it on
  or change the amount, works even with a card already saved. Accepts
  `Idempotency-Key`.
- `POST /v1/credit/auto-topup/card` - Stripe Checkout (setup mode) to
  replace the saved card; nothing is charged
- `DELETE /v1/credit/auto-topup/card` - detaches the saved card
  immediately and deletes the WHOLE configuration (threshold and amount
  included), not just the card
- `GET /v1/billing/documents` - list issued tax documents for credit
  top-ups (`limit`, `before` cursor)
- `GET /v1/billing/documents/{id}` - one tax document's data
- `GET /v1/billing/documents/{id}/pdf` - the same document as
  `application/pdf`

```bash
curl https://volai.cz/v1/balance \
  -H "Authorization: Bearer vk_YOUR_KEY"
```

### Tasks

Outbound calling campaigns - one agent dials a list of recipients under
rules you set (budget, calling window, attempts). Full guide with the CSV
import, status transitions and global throughput: `/en/docs/tasks`.

- `GET /v1/tasks` - list of tasks on the account (capped at 100, no
  pagination)
- `POST /v1/tasks` - creates a task in `draft` status; nothing is dialed
  yet. Any active agent is accepted here, including one on ElevenLabs -
  the engine requirement (chosen at agent creation via
  `useForOutboundTasks: true`) is only checked at
  `POST /v1/tasks/{id}/start`, which then fails with `engine_required`.
  At most 1000 recipients; the whole task with its variables must stay
  under 2 MB. Accepts `Idempotency-Key`.
- `GET /v1/tasks/{id}` - task detail, including `issues` - a dry-run of
  what currently blocks it from starting
- `PATCH /v1/tasks/{id}` - updates an editable task's rules (`name`,
  `recipients`, `callingWindow`, `maxAttempts`, `maxDurationSecs`,
  `budgetHal`); `revision` required
- `POST /v1/tasks/{id}/start` - starts or resumes dialing; every answered
  call is billed as it happens. Accepts `Idempotency-Key`.
- `POST /v1/tasks/{id}/pause` - stops further dialing before the next
  attempt; a call already in progress finishes
- `POST /v1/tasks/{id}/items/{itemId}/resolve` - retries or skips one item
  waiting for review (`action`: `retry`/`skip`, latest `revision` required).
  For `billing_unknown`, both actions preserve the original call and budget
  reservation until its actual price is reconciled. Skip prevents another
  call but does not cancel the original charge; Retry cannot dial again
  before settlement. Other unresolved task-level issues can keep the task
  in `needs_attention`; otherwise it becomes paused or completed. Read it
  back and resolve its reported issue before calling `start`
- `POST /v1/tasks/{id}/reconcile` - reconciles the task's state with the
  actual calls after an interruption; safe to call anytime, `revision`
  optional
- `DELETE /v1/tasks/{id}` - deletes a task without an item in progress, in
  draft/ready/paused/completed/needs_attention status (`revision` via
  `?revision=` or a JSON body)
- `POST /v1/tasks/csv-preview` - parses and validates a recipient CSV
  before creating or updating a task; nothing is saved, per-row errors
  come back in a 200 response

```bash
curl -X POST https://volai.cz/v1/tasks \
  -H "Authorization: Bearer vk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Payment reminder","agentId":"ag_...","taskType":"custom","source":"manual","budgetHal":50000,"recipients":[{"phone":"+420777123456"}]}'
```

### Numbers

- `GET /v1/numbers` - list of numbers on the account
- `POST /v1/numbers` - buys a number (empty body `{}`, or `{"e164": "..."}`,
  or `{"region": "praha" | "brno" | "internet" | "bratislava"}`). The
  response's `billingMonths` says how many months the recurring fee
  covers - 1 for Czech numbers, 3 for the Bratislava offer (paid three
  months upfront) - charged as `monthlyFeeHal * billingMonths`.
- `GET /v1/numbers/available` - offer of available numbers by region
- `PATCH /v1/numbers/{e164}` - changes routing (`agent` / `forward` / `sip` / `none`;
  for `sip` mode, optional `sipUsername`/`sipPassword` authenticate to the
  target PBX - see `set_number_routing` above; an omitted credential field
  keeps its stored value, and changing the server in `sipUri` requires
  sending `sipPassword` again). The response never echoes `sipPassword` back -
  it reports `hasSipPassword` instead, so you can check whether a login is
  stored from earlier without seeing the password itself
- `DELETE /v1/numbers/{e164}` - releases the number back to the pool
- `GET /v1/numbers/{e164}` - detail of one owned number, same shape as an
  item of the list above; useful when you only know the E.164
- `GET /v1/numbers/{e164}/sip` - SIP login credentials
- `GET /v1/numbers/{e164}/sip/status` - the TRUE SIP registration status
  and last inbound call for a number routed to "your own PBX" - unlike
  `routing.mode`, this is actually verified, not derived from settings.
  `registration` is `null` for a number pointed at a foreign PBX (a
  `sipa:` target with no challenge), where only `lastInbound` applies.
- `GET /v1/numbers/waitlist` - waitlist status per pool offer
  (`{offers:[{offerId,label,joined,available}]}`)
- `POST /v1/numbers/waitlist` - joins the waitlist for a sold-out offer
  (`{offerId?}`, default `praha`) after `POST /v1/numbers` fails with
  `pool_empty`; you get an email once it restocks
- `DELETE /v1/numbers/waitlist/{offerId}` - leaves the waitlist for one
  offer, without touching the waitlist for any other offer

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
- `POST /v1/messages` - sends an SMS (+420 / +421 only, up to 765 characters)
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

- `GET /v1/calls` - call history (optionally `direction=in|out`; also
  `from`/`to` Unix ms, `agentId`, `flagged` (`true`/`false`), `goal`
  (`success`/`failure`/`unknown`), `outcome`
  (`agent`/`transferred`/`no_answer`/`other`) - unknown query parameters
  are ignored)
- `PATCH /v1/calls/{id}` - your own annotation on a call: `note` (string
  or `null`, max 2000 chars), `flag` (`{reason}` max 500 chars, or
  `null` - setting a flag clears `handledAt`), `handled` (boolean - `true`
  sets `handledAt` to now, `false` clears it). At least one field
  required; `flag` (non-null) and `handled: true` cannot be sent together.
  Returns `{call}`.
- `POST /v1/calls` - starts a call: pass exactly one of `agentId` (the
  agent handles the conversation), `from` (a plain bridge between two
  numbers), or `systemPrompt` (a trial call with no number of your own,
  see below)
- `GET /v1/calls/{id}` - call detail including `transcript`, `summary` and
  `data` (what the agent recorded from the call per its `dataFields`; a
  `null` value means it never came up during the call); optional
  `waitSecs` (0-45, default 0) waits until the call reaches a terminal
  state and returns `stillRunning: true` if the time runs out first
- `GET /v1/calls/{id}/recording` - the call recording as raw audio bytes
  (not JSON) - its format follows the response's `content-type`:
  `audio/mpeg` (MP3) from an agent on ElevenLabs, `audio/ogg` from an
  agent on the volai engine today. The extension in `content-disposition`
  matches the same `content-type` - read the header, don't assume one
  fixed extension. `?stahnout=1` returns it as a downloadable attachment.
  Recordings are kept for 90 days, after that it's a 410
  `recording_expired`; a call with no recording returns 404 `no_recording`.

Both the list and the detail also carry `kind` (`agent`, `bridge`, `relay`,
`inbound`, `transfer`, `sip`), `answeredBy` (outbound calls only), `endReason`,
`data`, `hasRecording`, `durationSecs` (seconds; a call on the volai engine
can report a decimal value, rounded to 2 decimal places in the response),
and the annotation fields from `PATCH` above - `note`, `flag`, `handledAt`,
`goal` - always present, `null` when unset. An outbound call handled by
volai's own voice engine also carries `voicemailReason` (`phrase`,
`long_monologue`, `beep`, or `human_reply` - a person picked up with a
reply so short the detector noted it), `voicemailMessageLeft` (the engine
read the configured message into the voicemail), and
`voicemailDetectedAtSecs` (seconds from pickup until the engine's detector
reached a decision - even on a call a person answered) - ElevenLabs's
transcript-based `answeredBy` doesn't carry these three.

**Calls vs. conversations.** `GET /v1/calls` returns individual call
RECORDS - each phone leg is its own row, newest first. The portal groups
related legs (an inbound agent leg plus an outbound transfer leg) into
one CONVERSATION for its `/hovory` table - a successfully transferred
call therefore shows as ONE row in the portal but as up to two records
via the API/MCP (the leg that performed the transfer has
`outcome: "transferred"`; the receiving leg keeps its own `outcome`).
Sum call counts from the API with that in mind.

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

- `GET /v1/voices` - voice catalog for the agent `voiceId` field. Which
  platform an agent runs on is its own `provider` field (`engine` or
  `elevenlabs`) - volai decides the default, support can switch it,
  `useForOutboundTasks` chooses it at creation and a filled-in
  `transferTo` may trigger an engine switch when available. An agent on
  the volai engine can use any `id` from this catalog as `voiceId`
  except `anet` or a raw ElevenLabs voice id (those two stay reserved
  for an agent on ElevenLabs); an agent on ElevenLabs is limited to `anet`
  or a raw ElevenLabs voice id, and any other value is rejected with a 400.
  Creation has one exception: explicit `useForOutboundTasks: true` replaces
  a known ElevenLabs-only voice such as `anet` with the engine language
  default; an unknown id still fails. The same fallback does not apply
  when the field is omitted. Read the resulting `voiceId`.
  Filter `?provider=elevenlabs` returns only the voices an agent on
  ElevenLabs can use (today just the otherwise hidden `anet`);
  `?provider=engine` returns the same list as no filter, because the
  engine can play any voice in the catalog.

### Agents

- `GET /v1/agents` - list of agents
- `GET /v1/agents/{id}` - agent detail
- `POST /v1/agents` - creates an agent (`name`, `systemPrompt` required); `useForOutboundTasks` selects the creation path (true: engine, false: ElevenLabs, omitted: deployment default; creation only). A transfer configuration may subsequently switch it to the engine; read back `provider` and `voiceId`. If `engine_setup_incomplete` is returned, find the existing agent with `list_agents` and complete setup in the portal or contact support; do not create it again
- `PATCH /v1/agents/{id}` - updates an agent
- `DELETE /v1/agents/{id}` - deletes an agent
- `POST /v1/agents/{id}/test-call` - a "call me from my own agent" test
  call. It's a regular billed call, just with its own cap of 3 per day per
  account. For more, use `POST /v1/calls`. MCP tool: `test_call`.
- `GET /v1/agents/{id}/draft` - reads the separate saved draft, the
  published snapshot, `revision`, `tested`, `history` and `operation`.
  Can return 403 `forbidden` on the shared demo agent.
- `PUT /v1/agents/{id}/draft` - saves a draft. Body:
  `{expectedRevision, draft}` (it never changes the running agent - only
  `.../draft/publish` does)
- `POST /v1/agents/{id}/draft/publish` - explicitly applies the saved draft
  to the provider. Body: `{expectedRevision}`
- `POST /v1/agents/{id}/draft/rollback` - rolls the agent back to an
  earlier PUBLISHED revision from history and deploys it right away, like
  `publish` - it touches the provider and telephony, it isn't just a
  draft overwrite. Body: `{expectedRevision, targetRevision}` (the latter
  from the `history` array on `GET .../draft`). No `Idempotency-Key` -
  rollback is idempotent by nature, the target revision is explicit. MCP
  tool: `rollback_agent_draft`.
- `GET /v1/agents/{id}/draft/operation` - reads a running or uncertain
  provider operation. Can also return 403 `forbidden` on the shared demo
  agent.
- `POST /v1/agents/{id}/draft/operation` - reconciles an uncertain operation
  after a provider readback confirms the live configuration. Body:
  `{operationId, decision: "acknowledge_live_state"}`. MCP tool:
  `reconcile_agent_draft_operation`.
- `POST /v1/agents/{id}/simulate` - sends a text message to the saved draft
  without calling tools or placing a phone call. Body:
  `{expectedRevision, message, messages?}`. After a successful simulation
  it can still come back 409 `publish_in_progress` / `operation_uncertain`,
  or 500 `storage_failed`, if saving the resulting `tested` marker fails.

**Draft, or PATCH?** PATCH changes the live agent immediately and is right
when you're the only editor. A draft is right when a human might be
editing the same agent in the volai portal at the same time (the portal
editor works exclusively through drafts), when you want to review or try
out a change before it ships, or when you need optimistic concurrency.
The lock on an agent is SHARED between `PATCH` and `.../draft/publish` - a
`PATCH` during a running publish returns 409 `in_progress`; a `PATCH`
outside one goes through, bumps `revision`, clears `tested`, and leaves
`draft` untouched, so a concurrent draft save then hits 409
`revision_conflict` (with `currentRevision`) - by design, not a bug.

`draft`/`published` share one shape, `AgentDraftSnapshot`: `name`,
`language`, `systemPrompt` and `provider` are required (a draft is a
complete snapshot, not a partial patch); `provider` must exactly match
the agent's current `provider` or you get `invalid_draft`; `toolIds` and
`dataFields` are capped at 10 each. The body of `PUT`/`publish` is
`.strict()` - unlike `PATCH /v1/agents`, an unknown key returns 400
`validation` instead of being silently dropped, so always send back
exactly the object you read from `GET`.

`operation` (`null` when nothing blocks the agent) is
`{ id, kind, status, expectedRevision, createdAt, updatedAt }`. `kind` is
one of `update` (a live edit via PATCH), `publish`,
`rollback` (`POST .../draft/rollback`, see above) or `outbound_task` (a
batch outbound job is using this agent).
`status` is one of `running`, `uncertain` (the provider may or may not
have applied the change - do NOT blindly retry, resolve via
`.../draft/operation`), `drift` (needs a manual decision), `failed`
(certain failure, draft unchanged, feel free to retry) or `done`.

`tested` (on `GET .../draft` and the simulate response) is
`{ revision, testedAt } | null` - whether THIS exact revision was last
checked with `POST .../simulate`. Simulation is entirely optional (not
required to publish), free for the customer (0 CZK, volai pays), capped
at 20 per hour per account, runs on a fixed Anthropic model with no
tools and no voice - it checks the wording, not a real call.

Every agent record carries a `provider` field (`engine` or `elevenlabs`)
that says which platform actually places and takes its calls - it is
read-only in `POST`/`PATCH` bodies, but two things do set it:
`useForOutboundTasks` at creation, and turning on `transferTo` (see
below); support can also switch it on request. Goal evaluation and the
post-call summary email currently only work for `provider: "engine"` (see
`goal` and `notifyEmail` below).

Besides `name`, `systemPrompt`, `firstMessage`, `language`, `voiceId` and
`numberE164`, both `POST` and `PATCH` take fields from the tools and
recordings wave:

- `toolIds` - ids of the webhook tools the agent may call (at most 10),
- `transferTo` - an E.164 number to transfer to a human (an empty string
  turns transfer off; it must not be your own volai number -
  `transfer_loop`), `transferCondition` - when it should transfer,

Setting `transferTo` is the one exception to "you never change `provider`
yourself" (besides `useForOutboundTasks` at creation). Transfer to a human
only works on volai's own engine, so any write that leaves a non-empty
`transferTo` on the agent - `POST`/`PATCH /v1/agents`, `create_agent` /
`update_agent`, or publishing a draft - attempts an automatic switch to
`provider: "engine"` after the record is saved. The switch can be paused,
unavailable or unsuccessful, so verify the returned provider before
promising that handoff works. If its `voiceId` is one the
engine cannot play as a main voice (`anet`, or anything outside the volai
catalog such as a raw ElevenLabs voice id), the voice is replaced with the
engine's default for the agent's language (Czech gets `milena`) and the
swap is written to the agent's log. Read `provider` and `voiceId` back after
any write that sets `transferTo`, and expect the recording format to change
with the platform (`audio/ogg` on the engine). If the switch fails, the
agent keeps the transfer setting but stays on `elevenlabs`, where the
transfer will not complete.

- `dataFields` - what the agent records from the call: an array of
  `{key, type, description, enumValues}` objects, at most 10; the result
  comes back in the call's `data`,
- `recordCalls` - whether to record the agent's calls (default `true`).

Plus the agent's goal, knowledge and post-call email:

- `goal` - the call's goal in one sentence, used by an LLM judge after the
  call to score it met/not met (up to 300 characters; only evaluated for
  an agent on volai's own engine). On `PATCH`, `null` or an empty string
  clears it.
- `knowledge` - extra text the agent knows besides its instructions, e.g.
  a price list or FAQ, appended to the end of the prompt (up to 20000
  characters). On `PATCH`, `null` or an empty string clears it.
- `notifyEmail` - whether to email the account owner a summary after
  every call this agent takes (default `true`); today the summary is
  only ever sent for an agent whose `provider` is `engine` - an agent on
  ElevenLabs keeps the setting but it has no effect yet.

`goal` and `knowledge` are always present in the response, `null` when
unset - unlike the tools/recordings fields above, which are simply
missing from an older agent's response until someone sets them.
`notifyEmail` is always a boolean.

`POST /v1/agents`, `PATCH /v1/agents/{id}` and `POST
/v1/agents/{id}/draft/publish` can return a `warnings` array beside the
result - `{id, warnings}` on create, `{agent, warnings}` on update,
`{revision, published, warnings}` on publish; MCP `create_agent`,
`update_agent` and `publish_agent_draft` return the same array in
`structuredContent.warnings`. The key is absent when there is nothing to
warn about. Today there are two codes. `first_message_no_ai_disclosure`:
the EU AI Act (Article 50) requires the first line to disclose that a
digital assistant is speaking, and the agent's saved `firstMessage` does
not - you get the warning just as well when you send no `firstMessage` at
all, because the default one does not disclose it either.
`first_message_too_long`: the first line's estimated spoken duration -
measured against what the caller actually hears, the greeting plus the
call-recording notice sentence added when `recordCalls` is on - is over
7 seconds (about 2.53 words per second; digits always, and all-caps
abbreviations up to four characters, count per character; a longer
all-caps word counts as one word). Callers who interrupt the agent most
often do so within one second of audible speech, so a long greeting
raises the risk a call ends before the agent finishes speaking. This
code never fires on an unchanged default opening line, only on one you
have edited. Neither code is a rejection - the agent is created,
updated or published either way, and meeting the limits stays your
responsibility.

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
- `GET /v1/tools/{id}` - tool detail, plus `agents` (the agents that have
  it enabled via `toolIds` - just `id` and `name`)
- `PATCH /v1/tools/{id}` - update, all fields optional
- `DELETE /v1/tools/{id}` - deletes the tool and returns the `agents` it
  stopped working for
- `POST /v1/tools/test` - sends a REAL request for a spelled-out
  definition that is NOT saved (`label`/`description` optional); handy
  for trying an address before saving it as a tool. MCP tool: `test_tool`.
- `POST /v1/tools/{id}/test` - tests an ALREADY-SAVED tool by `id` with
  its real, unmasked headers; body is always `{}`. Shares one rate limit
  with `POST /v1/tools/test` above - 10 attempts/minute per account
  combined. Both return `{status, durationMs, body, note}`.

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

Configure the platform's outbound trunk with `outboundTrunkAddress` from
`get_sip_credentials`, NOT `server` - the trunk address must be exactly
this value, so a trunk pointed at `server` is not routed on the network
and reports a timeout (`1011 sip request timed out`), with nothing left
in the call history. Dialing the destination number directly through the
trunk, without a relay lease, does not work either - see the
troubleshooting table at `/en/docs/bring-your-own-agent`.

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
`POST /v1/calls`, a test call, or relay. This restriction applies to calls,
not SMS; `send_sms` is unaffected.

The manual `numbers` list and the automatic `blocked` list are independent.
Removing a number from the manual list does not lift an automatic block, and
unblocking a destination does not remove it from the manual list. Automatic
blocks that started before version 1.8.0 may be absent from `blocked` because
they predate its listing index. If a call returns `destination_auto_blocked`,
use the failed number directly with the unblock endpoint or MCP tool even when
the list does not show it.

- `GET /v1/dnc` - list of numbers, plus destinations under an automatic block
- `POST /v1/dnc` - adds a number
- `DELETE /v1/dnc/{e164}` - removes a number from the manual list only
- `POST /v1/dnc/{e164}/unblock` - lifts an automatic block, if there is one

### Webhook

- `GET /v1/webhook` - current settings (without the secret), plus
  `recentDeliveries` (last 20 deliveries, including test events)
- `PUT /v1/webhook` - sets the URL and subscribed events, returns the
  signing `secret` (returned only once). An empty `url` removes the
  webhook.
- `DELETE /v1/webhook` - removes the webhook, same effect as `PUT` with an
  empty `url`, just explicit. MCP tool: `remove_webhook` (carries
  `destructiveHint: true` - set a new webhook again any time via `PUT`).
- `POST /v1/webhook/test` - sends one test event (`webhook.test`, no
  retry) to the configured URL regardless of the `events` filter - this
  tests deliverability, not the subscription. 404 `not_found` when no
  webhook is set; capped at 10 per hour.
- `GET /v1/webhook/deliveries` - the last 20 deliveries (successful,
  failed and test ones), the same shape as `recentDeliveries` above. MCP
  tool: `list_webhook_deliveries`.

### Changelog

- `GET /v1/changelog` - the machine-readable changelog: current `version`
  plus ALL entries newest first, `{version,entries:[{id,date,version,
  areas,audience,breaking,title,body,technical,url}]}`. No API key, no
  query parameters (one document, one URL - filter the `entries` array
  yourself), rate limited per IP (30/min), `Cache-Control: public,
  max-age=300`. Same data as `/en/changelog` and MCP `get_changelog`,
  which additionally filters by `since` (a date or version - only newer
  entries), `area`, and `limit` on the server.

## Idempotency

The write endpoints `POST /v1/calls`, `POST /v1/messages`,
`POST /v1/numbers`, `POST /v1/numbers/orders`, `POST /v1/agents`, `POST /v1/tools`, `POST /v1/relay`,
`POST /v1/agents/{id}/draft/publish`,
`POST /v1/agents/{id}/test-call`, `POST /v1/integrations`, `POST /v1/tasks`,
`POST /v1/tasks/{id}/start`, `POST /v1/credit/topup` and
`POST /v1/credit/auto-topup/setup` accept an
`Idempotency-Key` header.
Retrying with the same value doesn't perform the action twice and returns
the original response for 24 hours - useful for safely retrying after a
network failure. Keys share one namespace per API key across all these
endpoints: method, path and body are not compared before a cached response
is returned. Use a new unique value for every distinct action, including
actions on different endpoints; reuse it only for the same logical request.
An order id from your app must include the action type if that order causes
more than one API action. A second
request with the same key while the first one is still being processed
gets a 409 `idempotency_in_progress` instead of a duplicate action or a
copy of an unfinished response - wait a moment and retry with the same
key.

For `POST /v1/numbers/orders`, the key is durably bound to the order before
the operator is called. Reusing it with a different address returns 409
`idempotency_conflict`. If the operator gives an ambiguous response after a
purchase, review the order status before retrying.

## Rate limits

60 requests per minute per API key, shared between REST and MCP. OAuth
connections have a separate 60-per-minute limit per grant (they run
on the same key). Exceeding it returns 429 with a `Retry-After` header.
After the key is verified, every response (success or error) also carries
`RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` (seconds
until the window resets). `POST /v1/messages` has an additional cap of
its own: at most one SMS every 2 seconds and 100 SMS per day per account.
`POST /v1/webhook/test` is capped at 10 per hour; `simulate_agent_draft`
at 20 per hour.

Outgoing calls (`POST /v1/calls`, relay and the trial call) share their own
cap: 10 calls per minute and 200 per day per account, with at most 2
built-in agent calls running concurrently.

## Pagination

`GET /v1/messages` and `GET /v1/calls` (and MCP `list_messages`,
`list_calls`) take `limit` (max records, default 50, capped at 200) and
`before` (ms timestamp - returns only older records, EXCLUSIVE: the last
record of the previous page never repeats). The response also carries
`hasMore` (boolean) and `nextBefore` (the timestamp of the last returned
record, or `null` when `hasMore` is `false`) - pass `nextBefore` as the
next `before`, no manual offset math. Two records sharing the exact same
millisecond timestamp at a page boundary can rarely cause one to drop out,
so deduplicate by `id` if that matters to you. For `GET /v1/calls?direction=`,
`hasMore: true` can mean either "there is definitely another page" or "we
haven't scanned far enough yet to be sure" - `false` always means history
truly ended.

## Webhooks

Five events:

- `call.completed` - the call finished. Agent calls also carry
  `transcript`, `summary` and `data` (values recorded per the agent's
  `dataFields`; the key is missing from the body when the agent collects
  nothing).
- `call.failed` - the call ended up in `status: "failed"`, on any provider
  or path (an agent on the volai engine or on ElevenLabs, a plain bridge,
  a BYO relay lease, a trial call). Fires exactly once per call. Payload:
  `{id, direction, from, to, reason, endReason}` - `reason` is the
  technical cause, `endReason` is the same value the call record carries.
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

Rates and credit are quoted excluding VAT. Checkout applies the account's
VAT regime: normally 21% Czech VAT, or reverse charge for eligible verified
EU business accounts. Calls are billed by the second,
not rounded up to whole minutes. Credit never expires, no plans or custom
packages.

## Typical flows

Covers the same ground as the MCP server's own instructions
(`SERVER_INSTRUCTIONS`), so a client reads consistent advice whichever
side it looks at.

1. **A trial call with no number of your own.** `make_call` (or
   `POST /v1/calls`) with `systemPrompt` instead of `agentId`/`from` ->
   calls right away from a shared volai demo number, no number purchase
   or agent setup needed -> `get_call` with `waitSecs` (e.g. 30) waits for
   up to that many seconds. If it is still in progress, wait and read again;
   after completion, check transcript and summary availability in the result.
   Billed normally, daily limit 3 calls per account. To test an existing
   agent, `test_call` (`POST /v1/agents/{id}/test-call`)
   is the lighter check - same real call and price, capped at 3
   per account per day across ALL agents.
2. **Buy a number and set up an agent.** `buy_number` (or
   `POST /v1/numbers`) -> `create_agent` with a name, `systemPrompt` and
   `numberE164` from the previous step right away (one tool creates the
   agent and attaches the number at once). Use `set_number_routing`
   (`PATCH /v1/numbers/{e164}`) to attach an existing agent or change the
   number's routing later.
   If buying fails with `pool_empty`, `join_number_waitlist` instead of
   retrying - it emails the account once a number is available;
   `leave_number_waitlist` cancels that later. `get_number` reads one
   owned number's detail.
3. **A number from a region outside the standard offer.**
   `find_number_address` with `query` (the whole address in one call), or
   step by step down to `cp`, until `recap` appears -> `order_number_from_region`
   with the codes from there -> `list_number_orders` for status.
4. **Send an SMS.** `send_sms` (or `POST /v1/messages`) with `to` and
   `body` - a custom sender name isn't supported, sign your name directly
   in the text.
5. **Make a call with your own agent and read the transcript.** `make_call`
   with `agentId` -> `get_call` with `waitSecs` waits for the call to
   finish, up to the requested timeout. If it remains in progress, wait and
   read again. Check `transcript` (an array of turns) and `summary` after
   completion; an empty value does not prove that processing has finished.
6. **A custom agent on another platform, or your own PBX.**
   `create_relay_lease` with `from` (your volai number) and `to` (the
   destination) -> use the returned `sipName` in your platform as the
   destination number -> `list_relay_leases` / `cancel_relay_lease`.
   Configure the platform's outbound trunk with `outboundTrunkAddress`
   from `get_sip_credentials`, not `server` - the trunk address must be
   exactly `outboundTrunkAddress`; a different address fails with `1011
   sip request timed out`. Dialing
   the destination number directly through the trunk instead of using a
   relay lease does not work. To hand a number to a real SIP PBX instead
   (routing mode `sip`), `get_sip_credentials`
   (`GET /v1/numbers/{e164}/sip`) gives the login to configure it, and
   `get_sip_status` (`GET /v1/numbers/{e164}/sip/status`) checks
   afterward whether it actually registered and whether the last inbound
   call reached it.
7. **Block a number.** `add_to_dnc` -> the built-in agent and relay then
   both refuse it. With your own agent outside relay, you have to check
   `list_dnc` yourself. An automatic block from repeated failed attempts
   can be lifted early with `unblock_destination` instead of waiting out
   the 30 days. If an older block is absent from `list_dnc`, use the number
   from `destination_auto_blocked` directly. This list does not restrict SMS.
8. **Give the agent a tool.** `create_tool` (or `POST /v1/tools`) ->
   `test_tool` to confirm the endpoint actually answers before relying on
   it -> send the returned `id` in `toolIds` to `update_agent` -> tell the
   agent in `systemPrompt` when to use it. Creating the tool alone doesn't
   change any agent.
9. **Record something from a call and listen back to it.** `update_agent`
   with `dataFields` -> after the call, the filled-in `data` arrives in
   `get_call` and in the `call.completed` webhook -> download the audio
   from `GET /v1/calls/{id}/recording` (90 days from the call).
10. **Safe agent edit.** `get_agent_draft` -> `save_agent_draft` ->
    (optional) `simulate_agent_draft` -> `publish_agent_draft`; simulation
    is optional, free and capped at 20/hour. Use this when a human might
    be editing the same agent in the portal at the same time, or when you
    want to review a change before it goes live - for an instant change
    with no review step, `update_agent` directly. If `publish_agent_draft`
    or `rollback_agent_draft` (`POST .../draft/rollback`) comes back
    `operation_uncertain`, do NOT retry blindly: `get_agent_draft` to see
    the operation, have a human check what is actually live, then
    `POST .../draft/operation` (MCP `reconcile_agent_draft_operation`)
    with `{decision:"acknowledge_live_state"}` to unlock it.
    `rollback_agent_draft` restores an earlier published revision from
    `get_agent_draft`'s `history` when a published change needs undoing.
11. **Reviewing recent calls.** `list_calls` (or `GET /v1/calls`),
    optionally filtered by `flagged`, `goal`, `outcome`, `agentId` or a
    time window (`from`/`to`) -> `get_call` for the full transcript of one
    -> `annotate_call` (`PATCH /v1/calls/{id}`) to leave a note, flag an
    agent mistake with a reason, or mark it handled once dealt with.
12. **Setting up event notifications.** `set_webhook` with the URL and
    events -> `send_test_webhook` to confirm delivery actually works ->
    `list_webhook_deliveries` (or `get_webhook`'s `recentDeliveries`) to
    see recent attempts and verify the signature against the saved secret
    -> `remove_webhook` (`DELETE /v1/webhook`) to stop everything again.
13. **Reading accounting evidence for a payment dispute.**
    `list_integrations` for a connected Fakturoid/ABRA Flexi account ->
    `list_invoices` to search by number or company -> `get_invoice` for
    the freshest status and `amountDueMinor`. This never creates or marks
    an invoice paid.
14. **Whose account is this.** `get_account` (`GET /v1/account`) reads the
    profile; `list_api_keys` the keys on it. `update_account` changes
    `name`/`locale` (the language of emails and tax documents, not of
    REST/MCP responses); `update_billing_details`
    (`PUT /v1/account/billing`) changes the billing address and/or
    company/VAT details in one call - a verified foreign EU VAT id
    switches the account to reverse charge and changes what future credit
    top-ups cost, so confirm it with the user first.
15. **Update a calendar event.** `list_integrations` -> `list_calendars` ->
    `list_calendar_events` or `get_calendar_event` -> `propose_calendar_update`
    (never writes) -> show the user the original event and the patch ->
    `confirm_calendar_update` with `confirm: true` (REST:
    `PATCH /v1/integrations/{id}/events/{eventId}`). On
    `calendar_stale_revision`, read again and get the new proposal
    approved. See "Google and Apple Calendar" below for the full
    walkthrough.
16. **Pick a voice for a new agent.** `list_voices` (or `GET /v1/voices`,
    optionally filtered by `provider`) shows the catalog -> pass `voiceId`
    to `create_agent`, checking `list_agents` first for the account's
    existing agents and numbers already in use.
17. **Tidy up.** `delete_tool` (or `DELETE /v1/tools/{id}`) removes a tool
    no longer needed - the response lists the agents that lose it;
    `delete_agent` (or `DELETE /v1/agents/{id}`) removes an agent no
    longer in use. Both are destructive - confirm with the user first
    (see `destructiveHint` above).

## Onboarding - first setup driven by an agent

The portal's **AI assistant** guide (`/en/api-and-mcp`) has three steps:
connection, verification and a first task. Follow the customer's actual goal;
there is no mandatory call or number purchase during connection.

1. **Verify by reading.** Use only `get_balance` and `list_agents` first.
   The portal recognizes a successful authenticated MCP read with the
   selected active key. Installing a configuration, listing tools or making
   a REST request alone does not verify the MCP connection. Ask the customer
   to return to the guide after sending its verification prompt. Do not
   treat a past verification as continuous availability monitoring.
2. **Check the account before spending.** Read `get_account.emailVerified`
   rather than guessing from a zero balance. An unverified owner can enter
   the email's 6-digit code at `/en/auth/verify` (valid 15 minutes).
   A trial requires this and otherwise returns `trial_email_unverified`.
   A verified account with zero credit needs a top up, not another email
   verification. `create_topup_link` creates a Checkout URL, never charges a
   card itself; the customer completes payment at `/en/credit` or Checkout.
3. **Choose the job.** Ask only for missing information: the desired outcome,
   recipients, approved budget and calling window. Invoice reminders,
   appointment confirmations, incoming calls and custom tasks are all valid
   starting points. Treat sample prompts as drafts, not permission to dial.
   Read `list_integrations` when fresh calendar or accounting data is needed;
   guide the customer through the listed connection URL if it is missing.
4. **Prepare before starting.** For outbound campaigns, create an agent with
   `useForOutboundTasks: true`, prepare its `systemPrompt`, publish the draft
   and simulate the published revision. Use `create_task` to save a draft
   and `get_task` to review recipients, `issues` and budget. Only call
   `start_task` after the customer approves the actual recipient list and
   budget; send the matching `confirmedRecipients` and `confirmedBudgetHal`.
   Invoice payment is verified from accounting evidence, not from the
   recipient's spoken promise. Calendar changes require an explicit proposal
   and confirmation; no create-event or delete-event tool is offered.
5. **Test the voice if requested.** A trial uses `make_call` with
   `systemPrompt` (up to 1200 characters) and the approved `to` number.
   It costs real credit and has trial limits. `get_call` with `waitSecs` 30
   reads its result; a still-active call needs a later read, not another
   `make_call`. Use `list_voices` for the actual provider and `update_agent`
   to adjust the real agent. A text simulation does not test voice quality.
6. **Get a number when the chosen workflow needs it.** Incoming calls need
   a number; an engine agent can use the shared number for outbound calls
   without buying one. For incoming service, after approval of the recurring
   fee, use `search_available_numbers`, `buy_number`, then `create_agent`
   with the purchased `numberE164` (or route it to an existing agent).
   Choose `voiceId` for the final provider and read the configuration back.
7. **Report the verified result.** Say what is configured, what was tested,
   any action still waiting for approval and where to see it in the portal.
   Do not describe a saved task as running, a completed call as a successful
   business outcome, or an accepted SMS as confirmed delivery.

Never place a call, send an SMS, buy/release a number, delete an agent or
change an external event solely because an example includes that action.

## Errors

A failure always has the same shape:

```json
{
  "error": {
    "code": "insufficient_credit",
    "cause": "account",
    "message": "Insufficient credit. Top up at /en/credit.",
    "action": "Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.",
    "requestId": "req_9f2b7a1c4e6d8f0a",
    "docsUrl": "https://volai.cz/en/docs/api#errors"
  }
}
```

Every v1 response (success or error) carries a unique `req_` + 16 hex
request id in the `X-Request-Id` header; an error also repeats it in the
body as `requestId` (a replayed idempotent response gets its own current
`requestId`, so the header and body never disagree). `docsUrl` links back
to the Error format section. A `revision_conflict` from the agent-draft
endpoints (`PUT /v1/agents/{id}/draft`, `POST .../draft/publish`,
`POST .../draft/rollback`, `POST /v1/agents/{id}/simulate`) carries
`currentRevision`, and an `operation_uncertain` error can carry it too -
reload via `GET .../draft` before retrying. On a task
(`PATCH/DELETE /v1/tasks/{id}`, `POST /v1/tasks/{id}/start|pause|reconcile`)
a `revision_conflict` has no extra payload - re-read `GET /v1/tasks/{id}`
and use its `revision`.

Common codes: `unauthorized` (401, key missing or invalid, carries a
`WWW-Authenticate: Bearer realm="volai", error="invalid_token"` header),
`insufficient_credit` (402, not enough credit left on the account, or the
account has no number of its own, no top-up, and has used up the cap of 3
SMS from the shared sender), `rate_limited` (429, 60 requests/min per key -
shared between MCP and REST, wait per `Retry-After`), `internal_error`
(500, try again). A few actions can return 502 (an upstream provider error)
or 503 (temporarily unavailable). Endpoint-specific field and error codes -
among them `idempotency_in_progress` (409, a request with the same
`Idempotency-Key` is still being processed, see Idempotency above),
`idempotency_conflict` (409, `POST /v1/numbers/orders` only, key reused
with a different address), `number_unavailable` (404, `POST /v1/numbers`),
`lease_already_active` (409, `DELETE /v1/relay/{id}` only, not `POST
/v1/relay`), `invalid_number`, `agent_not_found`, `on_dnc`,
`capacity_busy`, `not_found`, `invalid_draft`, `revision_conflict`,
`publish_in_progress`, `operation_uncertain`, `simulation_failed`,
`simulation_not_configured`, `simulation_unavailable`, `callback_failed`
(502, `POST /v1/calls` bridge only, the second leg couldn't be connected),
`agent_template_missing` (500, `POST /v1/agents`, a configuration problem
on volai's side, not yours), `in_progress` (409, `PATCH /v1/agents/{id}`
only - the shared lock with `.../draft/publish` is busy, or a previous
change went through but couldn't be confirmed; check `GET
/v1/agents/{id}/draft/operation` before retrying)... - are listed per
endpoint at `/en/docs/api`.

An unknown path under `/v1` (including bare `/v1`) returns a JSON 404
with the same shape as above, for every method (GET/POST/PUT/PATCH/DELETE/
OPTIONS/HEAD). The one exception: the wrong METHOD on an EXISTING path
(for example `DELETE /v1/balance`) stays a plain Next.js 405 with no JSON
body.

`cause` says whose problem it is and `action` says what to do, in one
English sentence you can show the user verbatim:

- `request` - the body, URL, headers or tool arguments you sent, including
  a missing or invalid API key. Fix the request and send it again; volai is
  up.
- `account` - the request was fine, the customer's account state blocks
  the action (credit, limits, ownership of a number or agent, e-mail
  verification, configuration, or a record that does not exist on this
  account). Tell the customer what to change, or which id to check.
- `busy` - a lock or a per-minute limit: another operation on the same
  record is still running, or the rate limit is used up. Wait a few
  seconds and repeat the same request unchanged.
- `service` - volai or its provider failed. Retry in a moment; if it
  keeps failing, contact podpora@volai.cz with the `requestId`.

When you relay an error to the user, go by `cause`, not by the HTTP
status: name the field from `message` for `request`, name the account
change or the id to check for `account`, wait and repeat for `busy`, and
only for `service` say that volai itself has a problem. Never describe a
`request`, `account` or `busy` error as a volai outage. The cause is
decided per error code, not per status - account quotas (`agent_limit`,
`tool_limit`, `api_key_limit`, `relay_lease_limit`) are 400 and still
`account`; `not_found` on a record is `account` (the response must not
reveal whether someone else's id exists), on an unknown path under `/v1`
it is `request`. The full code-to-cause table is in `GET /openapi.json`,
in the description of every error response.

`validation` messages name the field (a dotted path in the body, for
example `dataFields.0.type`), the actual value and the accepted maximum
(`Field "knowledge" is 210000 characters long, the maximum accepted is
200000.`, `Field "systemPrompt" is required.`, `Unknown field "revision".
Remove it; the documentation lists the accepted fields.`). Product limits
for an agent's name, instructions, goal and knowledge (60 / 6000 / 300 /
20000 characters) come as `invalid_name`, `invalid_system_prompt`,
`invalid_goal` and `invalid_knowledge` with the exact number.

MCP responses have no HTTP status - a caller detects a tool failure from
`isError: true`. The text starts with `Request error:`, `Account error:`,
`Busy:` or `volai service error:` and `structuredContent.error` carries the
same `code`, `cause`, `message`, `action`, `requestId` and `docsUrl` as
REST (plus `currentRevision` for agent drafts). A text that contains
`Input validation error: Invalid arguments for tool` (usually shown as
`MCP error -32602: ...`) comes from the MCP SDK before the tool runs, always
means `cause: request` and has no `structuredContent`. A missing or invalid
API key is HTTP 401 before any tool runs; the key lives in the MCP client
configuration.

## Error codes by area

Every endpoint-specific error code reachable from `GET /openapi.json`, grouped by API area (the same areas as `/en/docs/mcp`); `status`, `cause` and `action` are exactly what a REST or MCP error carries for that code. `unauthorized`, `rate_limited`, `internal_error`, `idempotency_in_progress` and `validation` are common to every area and documented once above, not repeated per area.

### Account

- `api_key_self_only` (403, request) - An API key can only revoke itself, not another key on the account. Revoke other keys in the portal under AI assistant (https://volai.cz/en/api-and-mcp). This is not a volai outage.
- `foreign_vat_unsupported` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `invalid_address` (400, request) - The address (street, city, ZIP) did not pass validation. Fix it in the request body and send it again; if you are unsure which field failed, check it in the volai portal at https://volai.cz/en/settings before retrying.
- `invalid_dic` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_ico` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_name` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `user_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `vat_id_not_found` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `vat_registry_unavailable` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.

### Connections

- `integration_busy` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `integration_invalid_calendar` (400, request) - Either the calendarUrl in the request body is not one iCloud returned for this account, or iCloud has no calendar to discover at all. Check the value against GET on this integration, or - if none exists yet - create a calendar in iCloud Calendar first, then connect again.
- `integration_invalid_provider` (400, service) - The server address (baseUrl) is not on the operator's allowlist for this deployment. Retrying will not help; use an allowlisted host, or contact podpora@volai.cz with the requestId to have it allowlisted.
- `integration_invalid_provider_response` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_not_found` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_provider_error` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_read_only` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_storage_error` (500, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_unauthorized` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_unsupported` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.

### Invoices

- `integration_busy` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `integration_credentials_unavailable` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_invalid_credentials` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_invalid_provider` (400, service) - The server address (baseUrl) is not on the operator's allowlist for this deployment. Retrying will not help; use an allowlisted host, or contact podpora@volai.cz with the requestId to have it allowlisted.
- `integration_invalid_provider_response` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_invalid_query` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `integration_not_configured` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_not_found` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_oauth_failed` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_provider_error` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `integration_refresh_in_progress` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `integration_unauthorized` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `integration_unsupported` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.

### Calendars

- `calendar_busy` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `calendar_confirmation_required` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_credentials_unavailable` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_invalid_calendar` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_invalid_credentials` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_invalid_patch` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_invalid_provider_response` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `calendar_invalid_query` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_not_configured` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `calendar_not_found` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_oauth_failed` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_provider_error` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `calendar_provider_mismatch` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_read_only` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_refresh_in_progress` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `calendar_stale_revision` (409, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_unauthorized` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `calendar_unsupported` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `calendar_verification_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.

### Balance

- `ledger_unavailable` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.

### Numbers

- `engine_readback_mismatch` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_unavailable` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `idempotency_conflict` (409, request) - The same Idempotency-Key was already used with a different body. Use a new Idempotency-Key for a new request, or repeat the original body unchanged to get the stored result.
- `incomplete_address` (400, request) - The address selection in the request body is incomplete. Send psc, obec, cobce and cp exactly as returned by GET /v1/numbers/address-options (ulice only where the address has a street), then send the request again. Nothing was charged.
- `insufficient_credit` (402, account) - Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.
- `invalid_sip_uri` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `not_sip_mode` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `number_unavailable` (404, service) - This number is no longer available from the operator. Retrying the same number will not help; list the current offer again (GET /v1/numbers/available or search_available_numbers) and pick a different one.
- `orders_disabled` (503, service) - Ordering numbers from other regions is switched off at the moment. Retrying will not help; pick one of the numbers already in stock (GET /v1/numbers/available) or try the order later.
- `pool_empty` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `provisioning_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `release_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `routing_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `sip_credentials_unavailable` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `user_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.

### SMS

- `insufficient_credit` (402, account) - Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.
- `invalid_body` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `recipient_cannot_receive_sms` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `recipient_is_virtual_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `recipient_rejected` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `send_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `send_failed_operator` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `send_unknown` (502, service) - Do not resend the message: it may already have been delivered. The record is in GET /v1/messages with status unknown and that status is final; we never learn more from the network. If the recipient confirms nothing arrived, contact podpora@volai.cz with the requestId and the credit will be refunded.
- `sms_gateway_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `unsupported_characters` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `unsupported_country` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.

### Calls

- `agent_no_number` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `agent_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `bridge_needs_number` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `call_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `call_rejected` (502, service) - The voice platform rejected the connection immediately; nothing was charged. Try again in a moment. If one destination keeps failing, that number may be unreachable.
- `callback_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `cannot_call_own_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `cannot_call_volai_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `capacity_busy` (503, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `destination_auto_blocked` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `destination_busy` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `insufficient_credit` (402, account) - Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.
- `invalid_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `no_recording` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `on_dnc` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `recording_expired` (410, service) - The recording was deleted after the 90-day retention period and cannot be recovered. Retrying will not help; the transcript and summary of the call are still available in GET /v1/calls/{id}.
- `trial_calls_disabled` (503, service) - Test calls without your own number are switched off at the moment. Retrying will not help; buy a number (POST /v1/numbers or buy_number) and create an agent on it, or try the test call later.
- `trial_email_unverified` (403, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `trial_not_configured` (500, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.

### Agents

- `agent_limit` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `agent_no_number` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `agent_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `agent_template_missing` (500, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `blocked_destination` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `capacity_busy` (503, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `engine_not_configured` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_readback_mismatch` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_setup_incomplete` (503, service) - The agent exists but its outbound setup did not finish. Do not create the agent again; open it in the volai portal (Agents) and finish the setup there, or contact podpora@volai.cz with the requestId.
- `engine_unavailable` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `in_progress` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `insufficient_credit` (402, account) - Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.
- `invalid_data_fields` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_goal` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_knowledge` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_language` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_name` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_system_prompt` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_voicemail_message` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `tool_limit` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `tool_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `transfer_loop` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `voicemail_requires_engine` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.

### Agent drafts

- `agent_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `blocked_destination` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `engine_not_configured` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_readback_mismatch` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_unavailable` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `forbidden` (403, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `in_progress` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `invalid_data_fields` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_draft` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_goal` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_knowledge` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_language` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_name` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_system_prompt` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_voicemail_message` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `operation_uncertain` (409, service) - Do not retry blindly: the provider may have applied the change. Check GET /v1/agents/{id}/draft/operation first and reconcile, then continue.
- `publish_in_progress` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `revision_conflict` (409, request) - Reload the record you are changing - GET /v1/agents/{id}/draft (or the get_agent_draft tool) for an agent draft, GET /v1/tasks/{id} (or the get_task tool) for a task - reapply your change on top of its current revision and send the request again with that value in expectedRevision (agent draft) or revision (task). This is not a volai outage.
- `simulation_failed` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `simulation_not_configured` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `simulation_unavailable` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `storage_failed` (500, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `tool_limit` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `tool_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `transfer_loop` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `voicemail_requires_engine` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.

### Tools

- `eleven_labs_error` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `eleven_labs_mismatch` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `invalid_tool_headers` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_tool_name` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_tool_params` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_tool_url` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `private_address` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `tool_limit` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `tool_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.

### Webhooks

- `invalid_events` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `invalid_url` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.

### Relay

- `capacity_busy` (503, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `destination_busy` (409, busy) - Another operation on the same resource is still running, or a limit for this moment is used up. Wait a few seconds and repeat the same request unchanged. Nothing is wrong with the request, the account or volai.
- `from_number_not_owned` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `insufficient_credit` (402, account) - Top up the credit at https://volai.cz/en/credit (or ask the account owner to), then send the request again. Nothing was charged and volai itself is up.
- `invalid_number` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `lease_already_active` (409, account) - A call is running through this relay lease right now, so it cannot be cancelled. Wait until the call ends, then cancel again. This is not a volai outage.
- `lease_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `on_dnc` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `relay_lease_limit` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.

### Tasks

- `agent_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.
- `agent_not_ready` (409, account) - Publish the agent's draft configuration and simulate the published version (POST /v1/agents/{id}/draft/publish, then POST /v1/agents/{id}/simulate or simulate_agent_draft in MCP) before starting or restarting this task.
- `budget_too_low` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `engine_contract_unavailable` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `engine_required` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `item_not_resolvable` (409, account) - Only a task item with status review can be retried or skipped, and only while the task is not running. Read the task again (GET /v1/tasks/{id} or get_task), pick an item whose status is review, and pause the task first if it is running.
- `items_immutable` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `revision_conflict` (409, request) - Reload the record you are changing - GET /v1/agents/{id}/draft (or the get_agent_draft tool) for an agent draft, GET /v1/tasks/{id} (or the get_task tool) for a task - reapply your change on top of its current revision and send the request again with that value in expectedRevision (agent draft) or revision (task). This is not a volai outage.
- `task_needs_attention` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `task_not_deletable` (409, account) - Only a task without an item currently in progress, in one of draft, ready, paused, completed or needs_attention, can be deleted. Pause it first if it is running, or wait for the in-progress item to finish.
- `task_not_editable` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `task_not_found` (404, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `task_not_running` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `task_not_startable` (409, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `window_closed` (409, account) - Wait for the calling window to reopen, or change callingWindow on the task (PATCH .../tasks/{id} or update_task) to a window that is currently open, then start it again.

### Credit

- `autotopup_not_configured` (400, account) - Your request was fine; the state of your volai account blocks it (credit, limits, ownership of a number or agent, verification, configuration). Change that in the volai portal or with another call, then try again. volai itself is up.
- `billing_address_required` (400, account) - Add a complete billing address (street, city, ZIP) in the volai portal at https://volai.cz/en/settings, then send this request again. Nothing was charged.
- `invalid_amount` (400, request) - Fix the request (body, URL, headers or tool arguments) and send it again. This is a problem with the request itself, not a volai outage.
- `ledger_unavailable` (503, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `stripe_error` (502, service) - Nothing to fix on your side. Try again in a moment; if it keeps failing, contact podpora@volai.cz and include the requestId from this error.
- `stripe_not_configured` (503, service) - Payments are switched off for this volai deployment (Stripe is not configured), not for your request specifically. Retrying will not help; if you believe payments should be enabled, contact podpora@volai.cz with the requestId.
- `user_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.

### Billing documents

- `invoice_not_found` (404, account) - No record with this id exists on the account this API key belongs to; the id may be mistyped, deleted, or from another account. List the records again (for example GET /v1/agents or GET /v1/calls) and use an id from that list. This is not a volai outage.

## OpenAPI

`GET /openapi.json` (https://volai.cz/openapi.json) - a machine-readable
OpenAPI 3.1 description of the whole API, no API key required,
`Cache-Control: public, max-age=3600` and CORS enabled. Generate a typed
client, a Postman collection, or wire the API straight into a tool like
n8n. `info.version` matches the version below.

## Versioning

Current version `1.12.0` (see `GET /openapi.json`, field `info.version`). Three
rules: (1) within v1, only optional fields and new endpoints are added - an
existing field never disappears, changes type, or changes meaning; an
integration that only reads fields it knows about is never broken by an update
(the one exception was 1.5.1, which stopped returning `answeredBy` for inbound
calls - see the entries below); (2) for agent drafts, always send back exactly
the object you read from `GET .../draft` - the body is `.strict()`, so an
unknown key returns 400 `validation` instead of being silently dropped; (3) a
required field or a change in meaning only ever ships as a new major version
(`v2`), never as a silent change to v1.

**12 Sep 2026 (1.12.0):** OAuth authorization code + PKCE S256, DCR,
resource-bound opaque tokens, refresh rotation/replay detection, OIDC
discovery/JWKS/userinfo and revocation. Access tokens last 10 minutes, refresh
tokens up to 30 days, grants up to 90 days. Password changes invalidate OAuth
access. MCP annotations explicitly distinguish overwrites, paid actions,
messages and external side effects.

**12 Sep 2026 (1.11.0):** `GET /v1/numbers/{e164}/sip` and MCP
`get_sip_credentials`: `outboundTrunkAddress` = `sip.volai.cz` (volai's own SIP
proxy with digest auth, realm `sip.volai.cz`; measured: the platform refuses an
INVITE larger than the UDP MTU, the same call passes over TCP), `transport` =
`tcp` (schema is now `enum [tcp, udp]`, UDP works too), `port` 5060 unchanged.
The watchdog monitors the proxy healthz (`SIP_PROXY_HEALTHZ_URL`): ops e-mail
when unreachable, when the auth data sync stalls or when the certificate has
under 14 days left. The ElevenLabs post-call webhook has its HMAC secret in
production and is enabled per agent (`ELEVENLABS_POST_CALL_WEBHOOK_ID`).

**12 Sep 2026 (1.10.0):** `GET /v1/numbers/{e164}/sip` and MCP
`get_sip_credentials`: `outboundTrunkAddress` is driven by its own configuration
(it may equal `server`), field descriptions no longer mention a realm;
`inboundSignallingCidrs` unchanged. The ElevenLabs post-call webhook matches
inbound calls via `metadata.phone_call.call_sid` (it used to read the SIP
Call-ID `call_id`, which never matched the `call:sid` key written by the
initiation webhook) through `findExistingCallByKeys` shared with the
`conversations-sync` cron (order `call:conv` -> `call:attempt` -> `call:sid`).
Per-agent post-call webhook settings
(`platform_settings.workspace_overrides.webhooks`) are migrated by the cron once
`ELEVENLABS_POST_CALL_WEBHOOK_ID` is set; until then the cron keeps closing
calls. The engine post-call accepts `phone_call.external_number: null` and
`caller_presentation`; the `uri_` caller prefix is stripped as in the initiation
webhook. The call transfer target (`transfer_to_number`) is built from a
separate `VOLAI_SIP_TRANSFER_HOST`, not from the public SIP domain. New internal
source of auth data for the SIP proxy (`GET /api/internal/sip-subscribers`,
outside v1, bearer + IP allowlist + rate limit).

**12 Sep 2026 (1.9.0):** `POST`/`PATCH /v1/agents` and MCP
`create_agent`/`update_agent` can now return a second `warnings` code:
`first_message_too_long`, independent of `first_message_no_ai_disclosure` - and
publishing an agent draft (`POST /v1/agents/{id}/draft/publish`, MCP
`publish_agent_draft`) and rolling it back to an earlier revision (`POST
/v1/agents/{id}/draft/rollback`, MCP `rollback_agent_draft`) now return the same
`warnings` too, which they previously omitted entirely - both of them write the
first line to the live agent. The estimate counts words, digits per character,
and all-caps abbreviations up to four characters; a longer all-caps word counts
as one word, so a company name written in capitals no longer inflates the
estimate. The single threshold (an estimated duration over 7 seconds) is
measured against what the caller actually hears - the greeting plus the
call-recording notice, when enabled. An unchanged default greeting template
never gets the warning, only a line the customer has edited.

**12 Sep 2026 (1.8.2):** Documentation, integration guides and error actions
point to AI assistant for access management. MCP makes clear that the voice
engine is required to start an outbound task; a task can also be created with an
ElevenLabs agent.

**12 Sep 2026 (1.8.1):** OpenAPI now describes Idempotency-Key for 14 supported
operations, response headers and the optional revision JSON body when deleting a
task. Documentation corrections without changing paid-action behavior:
`useForOutboundTasks` distinguishes true/false/omission, tasks support 1000
recipients and `billing_unknown` retains the original call and reservation until
its price is known. Credit tax documents are available over REST and MCP; an API
key can revoke only itself over REST; integration disconnect is REST/portal.
Correction to 1.6.1: `preview_task_csv` is not an MCP tool; use `POST
/v1/tasks/csv-preview` or the portal. Install commands share the onboarding
generator, example tabs have unique anchors and Python preserves JSON values.

**11 Sep 2026 (1.8.0):** The new REST `POST /v1/dnc/{e164}/unblock` and the
corresponding MCP tool `unblock_destination` lift an automatic destination
block; they also work for blocks created before this deployment. Older blocks
may be absent from `GET /v1/dnc` and `list_dnc` because they predate the listing
index, but direct unblock by phone number still works. Indexed blocks are
returned in a `blocked: [{e164, blockedAt, expiresAt}]` array (times are Unix
milliseconds) alongside the unchanged `numbers`. After a block is lifted, the
failed-attempt counter starts over - three new failed attempts to the same
number block it again, and lifting it again is not limited.
`groupCallsByConversation` (the shared primitive behind /hovory, the CSV export,
the Previous/Next navigation, and the stats) now sorts by
`representative.startedAt` descending; it used to sort by `key`, i.e.
alphabetically by conversation id. `TestCallOutcome` has a new `no_answer` value
kept separate from `failed`, so the panel never claims a cause it doesn't know.
A name written in ALL CAPS now gets an ALL CAPS vocative form (`RADEK` ->
`RADKU`) in both the e-mail and the Overview header.

**11 Sep 2026 (1.7.1):** `agent_busy` (HTTP 409, `cause: "busy"`) was added to
the shared error map `PUBLIC_ERROR_HTTP`/`PUBLIC_ERROR_CAUSE` (`lib/types.ts`).
It is returned by `switchAgentProvider` (`lib/service/engine-provider.ts`) - the
only portal admin action that switches an agent's provider; REST v1 and MCP have
no such input (`agents.switch_provider` in the capability catalog,
`lib/capabilities.ts`). The check uses a new `GET /v1/calls/active` client
(`lib/engine.ts` `listActiveCalls`): the agent's call is matched PRIMARILY by
the `agent_id` field, which the engine carries on an active call since the
version that added it was deployed; the number stays a fallback for an older
engine without it.

**11 Sep 2026 (1.7.0):** `POST`/`PATCH /v1/agents` and the MCP
`create_agent`/`update_agent`/`save_agent_draft` tools take a new `voicemail:
{enabled, action: "mark"|"hangup"|"message", message?}` field - only for an
agent with `provider: "engine"`, otherwise `voicemail_requires_engine`;
`message` is required when `action: "message"`, up to 400 characters
(`invalid_voicemail_message`). `GET /v1/agents` returns the configured value.
The engine's post-call now carries
`answered_by`/`voicemail_reason`/`voicemail_message_left`/`voicemail_detected_at_secs`;
`answered_by` takes precedence over the previous transcript-based estimate
(`lib/answered-by.ts`) only with `human` and `voicemail` - `unknown` is treated
as "the engine didn't decide" and the transcript-based estimate is used instead.
`GET`/`list_calls`/`get_call` for an outbound call handled by the engine also
return `voicemailReason` (a fourth value, `human_reply`, for a short human
reply), `voicemailMessageLeft`, and `voicemailDetectedAtSecs`.

**11 Sep 2026 (1.6.5):** For an outbound call ended before answer the engine
deletes the room and delivers a post-call webhook: empty transcript,
`call_duration_secs: 0` and the new additive field
`metadata.engine.termination_reason` (`no_answer` or
`disconnected_before_answer`). The call gets `status: no_answer`, `endReason:
no_answer` and price 0 as before, only immediately. The `GET /v1/calls`
reconciliation pairs engine outbound calls by `call_sid` and sends zero duration
for calls that never connected. `GET /openapi.json`: `answeredBy` now carries a
`description` about the outbound-only limitation.

**11 Sep 2026 (1.6.4):** `POST /v1/tasks` and `PATCH /v1/tasks/{id}` (and
`create_task`/`update_task` in MCP) accept up to 1000 `recipients`, `POST
/v1/tasks/csv-preview` up to 1000 rows. A new task record size check (2 MB of
serialized JSON) returns `validation` with field `recipients`.

**11 Sep 2026 (1.6.3):** ElevenLabs initiation webhook: the payload's `agent_id`
is now checked against the routed agent's `elevenAgentId` OR `id` - a foreign
`agent_id` gets only a minimal response without `conversation_config_override`;
the same check guards closing the conversation in the post-call webhook and the
conversations-sync cron. CDR-sync cron: an unrecognized outbound CDR record from
your own line (excluding the demo number), older than 600s and without an
ambiguously matching existing record, is now billed as `kind: "sip"` at the
outbound rate with no agent surcharge (it shows up in `GET /v1/calls` with
`kind: "sip"`; the `chargedSip` counter is only in the cron's own response, not
in the public API); a younger or ambiguously matching record is still just held
for manual review. `CallKind` extended with `"sip"`. The CDR shape of a real SIP
client call has no production evidence yet (no registered softphone) - hence
both safeguards.

**11 Sep 2026 (1.6.2):** New endpoint `POST
/v1/tasks/{id}/items/{itemId}/resolve` with body `{ action: "retry" | "skip",
revision }` and the MCP tool `resolve_task_item`; new error code
`item_not_resolvable` (409, account), `task_not_editable` for a running or
completed task. The engine call sync matches the account's own outbound leg by
relay line and start time, closes an unanswered outbound call as `no_answer` and
releases the tenant concurrency quota after closing. `relay_lease_limit` while
dialing a task is a transient state that does not consume an attempt.

**11 Sep 2026 (1.6.1):** `POST /v1/tasks/csv-preview` and the portal recognise
the phone column regardless of case, surrounding spaces and a trailing colon and
accept aliases (`telefon`, `tel`, `mobile`, `phone number`); the response always
names the column `phone`. A single-column input without a header whose first
value is a phone is treated as data. Without a phone column the preview returns
a single `phone` error on the header instead of `Phone is required` on every
row. The `agent_not_ready` contract is unchanged. Documentation correction, 12
Sep 2026: the original MCP-tool claim was incorrect; CSV preview is
REST/portal-only.

**11 Sep 2026 (1.6.0):** `GET /v1/numbers/{e164}/sip` and the MCP
`get_sip_credentials` tool now also return `outboundTrunkAddress`, `port`,
`transport` and `inboundSignallingCidrs` alongside
`server`/`username`/`password`; MCP `create_relay_lease` and the
`get_sip_credentials` description now explicitly distinguish `server`
(registration) from `outboundTrunkAddress` (a platform's outbound trunk). The
`/en/docs/bring-your-own-agent` guide, the ElevenLabs integration page and the
blog post no longer put `server` into `outbound_trunk_config.address` - only
`outboundTrunkAddress`.

**11 Sep 2026 (1.5.1):** `GET /v1/calls`, `GET /v1/calls/{id}`, the
`call.completed` webhook and MCP `list_calls`/`get_call`: `answeredBy` is
present only when `direction: "out"` (older records included). `POST
/v1/messages` and `send_sms`: an account without an active number and without a
positive `topup`/`refund`/`admin` ledger entry gets `insufficient_credit` (HTTP
402, cause `account`) after three sent SMS.

**8 Sep 2026 (1.5.0):** New REST endpoints: `GET`/`PATCH /v1/account`, `PUT
/v1/account/billing`, `GET /v1/api-keys`, `DELETE /v1/api-keys/{id}`
(self-revoke); `PATCH /v1/calls/{id}` and `GET /v1/calls` extended with `from`,
`to`, `agentId`, `flagged`, `goal`, `outcome` query parameters; `POST
/v1/tools/test`, `POST /v1/tools/{id}/test`, `DELETE /v1/webhook`, and `GET
/v1/tools/{id}` now additionally returns `agents`; `POST
/v1/agents/{id}/draft/rollback`; `GET /v1/numbers/{e164}`, `GET`/`POST
/v1/numbers/waitlist`, `DELETE /v1/numbers/waitlist/{offerId}`, `GET
/v1/numbers/{e164}/sip/status`; `POST /v1/integrations`, `DELETE
/v1/integrations/{id}`, `POST /v1/integrations/{id}/events/{eventId}/propose`;
`GET /v1/changelog` (no API key, `x-volai-version` on every v1 response
including errors, 429 and `/openapi.json`). 16 matching new MCP tools:
`get_account`, `update_account`, `update_billing_details`, `list_api_keys`,
`annotate_call`, `test_tool`, `remove_webhook`, `list_webhook_deliveries`,
`rollback_agent_draft`, `reconcile_agent_draft_operation`, `test_call`,
`get_number`, `join_number_waitlist`, `leave_number_waitlist`, `get_sip_status`,
`get_changelog` - revoking someone else's API key, creating an API key, and
disconnecting an integration or card stay REST-only or portal-only (spec §3).
The new capability catalog holds a `capability` field on every endpoint and
tool; guard tests verify the error table and response example on `/docs/api`
match the real error codes for every endpoint. Additive only - no existing
status or code changed. The new `content/changelog.json` file is the single
source of truth: `/en/changelog`, the changelog section on `/docs/api`, the
Versioning section in SKILL.md, RSS (`/en/feed/<area>`), `GET /v1/changelog` and
the MCP `get_changelog` tool are all generated views over it. Additive only - no
existing content disappeared. New REST endpoints: `GET`/`POST /v1/tasks`,
`GET`/`PATCH`/`DELETE /v1/tasks/{id}`, `POST /v1/tasks/{id}/start`, `POST
/v1/tasks/{id}/pause`, `POST /v1/tasks/{id}/reconcile`, `POST
/v1/tasks/csv-preview`. 7 matching new MCP tools: `list_tasks`, `get_task`,
`create_task`, `update_task`, `pause_task`, `reconcile_task`, `start_task`
(which requires repeating the real recipient count and budget, otherwise it
returns an error with the real numbers) - deleting a task and previewing a CSV
stay REST and portal only (spec §3). Portal: a Delete task button on the task
detail page with type-to-confirm. Additive only - no existing status or code
changed. New REST endpoints: `GET /v1/credit/ledger`, `POST /v1/credit/topup`,
`GET`/`PATCH /v1/credit/auto-topup`, `POST /v1/credit/auto-topup/setup`,
`POST`/`DELETE /v1/credit/auto-topup/card`, `GET /v1/billing/documents`, `GET
/v1/billing/documents/{id}`, `GET /v1/billing/documents/{id}/pdf`; `GET
/v1/balance` now additionally returns `runway` and `notice`. 6 matching new MCP
tools: `list_ledger`, `create_topup_link`, `get_auto_topup`,
`disable_auto_topup`, `list_billing_documents`, `get_billing_document`
(`get_balance` extended with the same `runway`/`notice`) -
`get_billing_document` does not return the PDF, which stays REST-only via `GET
/v1/billing/documents/{id}/pdf` (binary output); turning auto top-up on and
changing its amount or card stay behind a Stripe Checkout link only, MCP has
neither (spec §2, §3). Additive only - no existing status or code changed. `GET
/v1/account` now returns a new `notifications.productUpdates` field (on by
default); there is a matching toggle in portal Settings. The daily email digest
(cron `0 6 * * *` UTC) only sends to accounts with a verified email and
`productUpdates !== false`, at most one email per account per day. The
`List-Unsubscribe` header and cookie-free one-click unsubscribe now also cover
the reactivation email when `UNSUBSCRIBE_SECRET` is configured on the server -
without it the email still sends, just without the unsubscribe link. Additive
only - no existing status or code changed.

**8 Sep 2026 (1.4.3):** Every input property of all 44 MCP tools carries its own
`description` (clients see it in `tools/list`; the `PATCH .../events/{eventId}`
and `PUT /v1/agents/{id}/draft` bodies expose it in `openapi.json` too). The
invoice endpoints `GET /v1/integrations/{id}/invoices[/{invoiceId}]` list their
error codes by real reachability in the docs and in OpenAPI -
`integration_storage_error` was removed, it never came from the API - and their
query validation returns the human-readable message like the rest of v1 (same
for `GET .../events`). Additive only - no status or code changed.

**8 Sep 2026 (1.4.2):** Fixed Apple event reads and confirmed updates: iCloud
rejects UID searches, so event lists now return opaque CalDAV resource IDs. Pass
externalId unchanged as eventId; reload any Apple event IDs saved from earlier
versions. Invalid Apple IDs return 400 calendar_invalid_query. Google
identifiers are unchanged.

**8 Sep 2026 (1.4.1):** `POST /v1/agents` and `create_agent` accept
`useForOutboundTasks` (choosing volai's own voice engine at creation, the same
choice as the portal checkbox "Use for outbound tasks"; omitted = the deployment
default, today ElevenLabs). Additive only - no status or code changed.

**8 Sep 2026 (1.4.0):** Apple Calendar shares the same calendar flow over REST
and MCP as Google. Fakturoid and ABRA Flexi added `GET
/v1/integrations/{id}/invoices[/{invoiceId}]` plus the `list_invoices` and
`get_invoice` tools (the interface only reads invoices). `GET /v1/integrations`
and `list_integrations` also return `providers` with setup readiness and a
browser connection URL. Provider credentials still require connection in the
portal. Additive only - no status or code changed.

**7 Sep 2026 (1.3.0):** Google Calendar entered the public interface - `GET
/v1/integrations`, `GET /v1/integrations/{id}/calendars`, `GET
/v1/integrations/{id}/events`, `GET`/`PATCH
/v1/integrations/{id}/events/{eventId}` and six MCP tools (`list_integrations`,
`list_calendars`, `list_calendar_events`, `get_calendar_event`,
`propose_calendar_update`, `confirm_calendar_update`), which takes REST to 50
endpoints and MCP to 42 tools. Every error response also carries `cause`
(`request` / `account` / `busy` / `service` - who fixes it) and `action` (one
sentence on what to do). `validation` messages name the field, the actual value
and the accepted maximum instead of the raw validator text; the input caps for
an agent's name, instructions, goal and knowledge are ten times the product
limits, so the limit is always reported by the product error with the exact
number. MCP errors carry the same fields in `structuredContent.error` (including
`requestId`) and a text prefixed by cause. Additive only, no status or code
changed.

**6 Sep 2026 (1.2.0):** The `/v1/agents/{id}/draft*` and `/simulate` endpoints
lost the `ok` wrapper and plain-string errors - errors now share the same shape,
`{error:{code,message,requestId,docsUrl}}`, as the rest of v1; `revision` in
request bodies was renamed to `expectedRevision`; added `hasMore`/`nextBefore`
pagination fields, `X-Request-Id` and `RateLimit-*` headers, `POST
/v1/webhook/test`, `GET /v1/webhook/deliveries`, and `GET /openapi.json`. The
draft endpoints were already public from 5 Sep 2026, but without a stable
contract - they are therefore excluded from the versioning guarantee (rule 1 of
the Versioning section) up to and including 1.2.0.

Full list: https://volai.cz/en/changelog (also available as RSS).

## Google and Apple Calendar

Connect a Google account in `/en/connections` first. OAuth requires the signed-in
volai user in a browser; never request Google tokens in chat. Google has not yet
verified the sensitive events scope, so the consent screen shows an
unverified-app warning and Google caps the app at 100 users; the connection
still completes. Apple Calendar connects with an app-specific password and
supports the same list/read/update flow through REST and MCP.
`list_integrations` returns owned connection IDs and a browser connect URL.
REST uses the same `vk_` key: `GET /v1/integrations`,
`GET /v1/integrations/{id}/calendars`,
`GET /v1/integrations/{id}/events?calendarId=...`, and
`GET /v1/integrations/{id}/events/{eventId}?calendarId=...`.
Google and Apple event lists return `{events,nextPageToken?}`, up to 50 upcoming events.
Use the exact opaque `externalId` from the event list as `eventId`. Apple IDs
address CalDAV resources and are not iCalendar UIDs. Do not construct or decode
them. Invalid Apple IDs return `calendar_invalid_query`; list events again.
Use `search`, RFC3339 `timeMin`/`timeMax`, and `pageToken`; keep filters unchanged
across pages and pass a fixed `timeMin` when paging.

Read the event before changing it. Show the original values and proposal and get
explicit approval. `propose_calendar_update` never writes. Then use
`confirm_calendar_update` with `integrationId`, `calendarId`, `eventId`, the
unchanged `sourceRevision`, `patch`, and `confirm:true`. REST equivalent:
`PATCH /v1/integrations/{id}/events/{eventId}` with
`{calendarId,sourceRevision,patch,confirm:true}`. Patch supports `title`, `start`,
`end`. Use explicit offsets for timed events; all-day dates use YYYY-MM-DD and
an exclusive end. Preserve the opaque revision including quote characters.
Success returns `{event}` from a fresh provider readback. On
`calendar_stale_revision` (409), read again and get approval for the new proposal.
On `calendar_oauth_failed`/`calendar_unauthorized` (409), reconnect in the portal.
After uncertain writes or `calendar_verification_failed` (502), read and check
before retrying. This interface updates existing events; it does not create or
delete events. With Apple Calendar, `calendarId` must be one of the URLs
returned by `list_calendars`; anything else is rejected with 400
`calendar_invalid_calendar`. Disconnect with `DELETE /v1/integrations/{id}`;
there is no MCP tool for it, because disconnecting is irreversible. Full
schemas: https://volai.cz/openapi.json.

Connect Apple Calendar over REST with `POST /v1/integrations`
(`{provider:"apple-calendar",username,appPassword,calendarUrl?}`) - the
Apple Account email and an app-specific password (two-factor
authentication required), not the volai portal account. ABRA FlexiBee
connects the same way with
`{provider:"abra-flexi",baseUrl,company,username,password}`. Google Calendar
and Fakturoid only connect through the browser OAuth flow (`connectUrl` from
`GET /v1/integrations`); sending their `provider` to `POST /v1/integrations`
returns `integration_unsupported`. Pass a credential only if the user already
put it somewhere you can read (an env var or a file they named). Never ask
for one in conversation, never echo it back. `POST /v1/integrations/{id}/events/{eventId}/propose`
is the REST counterpart of `propose_calendar_update` - same body minus
`confirm`, never writes to the provider.

Calendars are discovered through iCloud CalDAV, including shared calendars.
A read-only calendar cannot be edited.
`recurring:true` identifies an Apple series, with start/end of its original
occurrence. Updating it changes the master and preserves individual exceptions;
this interface does not select or edit an individual occurrence of an Apple
series. Explain the series scope before seeking approval. Existing Apple floating
events can retain local timestamps without offsets. If the Apple calendar changes
between pages, `calendar_stale_revision` requires reloading the list.

## Fakturoid and ABRA Flexi invoices

Connect the account in `/en/connections`. Fakturoid uses browser OAuth and an
explicit company selection when multiple invoice-enabled companies are available.
ABRA Flexi requires an HTTPS server, company identifier and API user credentials;
the operator must allow the exact server hostname. Never request passwords or
provider tokens in chat. `GET /v1/integrations` and `list_integrations` return
`providers` with `ready` and `connectUrl` per provider. A configured server is not
evidence of a successful account connection.

Use `list_invoices({integrationId,search?})`, then
`get_invoice({integrationId,invoiceId})` to read fresh payment evidence. REST:

- `GET /v1/integrations/{id}/invoices?search=2026-0001`
- `GET /v1/integrations/{id}/invoices/{invoiceId}`

URL-encode identifiers and search. Search is performed by the provider, returning
the first 40 Fakturoid or 50 ABRA results, with no pagination token. Refine the query
to find older invoices. `amountDueMinor` is an integer in the currency's minor
units (not necessarily CZK); null means an unverified balance. `status:unknown`
and a missing amount are never evidence of payment. Detail includes `provider`,
`sourceUrl`, `fetchedAt` and `evidence:provider_response`. These interfaces only
read issued invoices; they do not issue invoices or mark them paid.

Invoice failures use `integration_` codes with `cause` and `action` like every
API error. `validation` (400) means `search` is longer than 100 characters, the
query carries an unknown parameter (unknown parameters are rejected here), or
`invoiceId` is missing or longer than 500 characters. Reconnect the account in
`/en/connections` on `unauthorized`, `oauth_failed`, `credentials_unavailable`
or `invalid_credentials` (409, cause account); wait and retry on `busy` or
`refresh_in_progress` (409); retry later on `provider_error` (502, includes
provider HTTP 403) or `invalid_provider_response` (502) and treat the invoice
state as unknown meanwhile; `not_found` (404) is a missing connection or
invoice; `unsupported` (400) means the connection is not an invoicing one;
`invalid_query` (400, search only) means ABRA rejected backslashes, control
characters or mixed quotes in `search`; `invalid_provider` (400) and
`not_configured` (503) need the operator. Do not substitute a cached or
caller-supplied payment claim for a failed provider read.

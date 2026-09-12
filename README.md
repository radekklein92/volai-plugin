# volai

Czech telephony API and MCP for apps and AI agents - numbers, calls, SMS,
voice agent. This plugin connects Codex and Claude Code to the volai MCP server
(75 tools: numbers, calls, SMS, voice agents, webhooks, connected calendars
and invoices) and bundles the full `volai` skill so Claude knows the API
conventions (E.164 numbers, prices in Czech hellers, idempotency keys)
without extra prompting.

## Install

```
claude plugin marketplace add https://volai.cz/.claude-plugin/marketplace.json
claude plugin install volai@volai
```

## Sign in with volai

The plugin uses OAuth. Connect the server, open the sign-in page, and
approve access to your volai account. The consent page describes access
to account data, voice agents, paid calls, SMS and number orders. Revoke
access at any time under **API and MCP** in the volai portal.

For a direct MCP connection in Claude Code:

```bash
claude mcp add --transport http volai https://volai.cz/mcp
```

Then use `/mcp` to authenticate. In Codex, add the remote MCP URL
`https://volai.cz/mcp` and sign in. This archive includes both the Claude
and Codex plugin manifests. Distribution through this project's own
marketplace does not imply approval by either official directory.

## API key alternative

Existing API keys remain supported. For a manual Claude Code connection:

```bash
claude mcp add --transport http --header 'Authorization: Bearer vk_YOUR_KEY' volai https://volai.cz/mcp
```

The REST examples in `examples/` read `VOLAI_API_KEY`:

```
export VOLAI_API_KEY=vk_YOUR_KEY
```

Get a key in the volai portal under **API and MCP**
(`https://volai.cz/en/api-and-mcp`) after signing up at
`https://volai.cz/en/auth/signup`. Treat the key like a password - anyone
who has it can spend your credit (buy numbers, place calls, send SMS).

## What you get

- **MCP server** (`https://volai.cz/mcp`) - the same 75 tools documented at
  `https://volai.cz/en/docs/mcp`, authenticated through OAuth or an API key.
- **`volai` skill** (`skills/volai/SKILL.md`) - the full API reference
  (authentication, conventions, endpoints, tool list) so Claude picks the
  right tool and field names without guessing.
- **Examples** (`examples/`) - two small Node 20 scripts
  (`send-sms.mjs`, `make-call.mjs`) that call the REST API directly with
  `fetch`, no dependencies.

## Try it

Once installed, just ask Claude Code things like:

- "Send an SMS to +420777123456 saying the order is ready."
- "Call me at +420777123456 and try being a cafe receptionist - I don't
  want to set up my own number or agent for this."
- "List my last 10 calls and summarize them."

## More

Full documentation: `https://volai.cz/en/docs`. Pricing:
`https://volai.cz/en/pricing`. Support: `podpora@volai.cz`.

## License

MIT, see `LICENSE`. (c) ANOVIA Finance s.r.o.

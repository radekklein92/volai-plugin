# volai

Czech telephony API and MCP for apps and AI agents - numbers, calls, SMS,
voice agent. This plugin connects Claude Code to the volai MCP server
(31 tools: numbers, calls, SMS, voice agents, webhooks) and bundles the
full `volai` skill so Claude knows the API conventions (E.164 numbers,
prices in Czech hellers, idempotency keys) without extra prompting.

## Install (Claude Code)

```
claude plugin marketplace add https://volai.cz/.claude-plugin/marketplace.json
claude plugin install volai@volai
```

## Install (Gemini CLI)

```
gemini extensions install https://github.com/radekklein92/volai-plugin
```

The manifest (`gemini-extension.json`) registers the same remote MCP
server; it reads the key from the `VOLAI_API_KEY` environment variable.

## Any other MCP client

Remote server URL: `https://volai.cz/mcp` (streamable HTTP), header
`Authorization: Bearer vk_YOUR_KEY`. Per-client setup (Cursor, Windsurf,
Claude Desktop, n8n, Make) is at `https://volai.cz/en/integrations`.

## Set up your API key

The plugin's MCP server reads the key from the `VOLAI_API_KEY` environment
variable:

```
export VOLAI_API_KEY=vk_YOUR_KEY
```

Get a key in the volai portal under **API and MCP**
(`https://volai.cz/en/api-and-mcp`) after signing up at
`https://volai.cz/en/auth/signup`. Treat the key like a password - anyone
who has it can spend your credit (buy numbers, place calls, send SMS).

## What you get

- **MCP server** (`https://volai.cz/mcp`) - the same 31 tools documented at
  `https://volai.cz/docs/mcp`, authenticated with the key above.
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

Full documentation: `https://volai.cz/docs`. Pricing:
`https://volai.cz/en/pricing`. Support: `podpora@volai.cz`.

## License

MIT, see `LICENSE`. (c) ANOVIA Finance s.r.o.

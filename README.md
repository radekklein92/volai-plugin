# volai

Czech telephony API and MCP for apps and AI agents - numbers, calls, SMS,
voice agent.

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

volai is a Czech alternative to Twilio for developers and AI agents:
+420 phone numbers, calls, SMS and a voice agent through one REST API and
one MCP server, billed per second in CZK.

- Docs: [volai.cz/docs/mcp](https://volai.cz/docs/mcp) (MCP), [volai.cz/en/docs](https://volai.cz/en/docs) (REST API)
- Get an API key: [volai.cz/en/api-and-mcp](https://volai.cz/en/api-and-mcp) (after signing up at [volai.cz/en/auth/signup](https://volai.cz/en/auth/signup), no credit card required to start)
- Full reference for AI agents and coding assistants: [`skills/volai/SKILL.md`](./skills/volai/SKILL.md) (installable via `npx skills add volai.cz`)

## What's in this repo

| Path | What it is |
| --- | --- |
| `.mcp.json` | MCP server config, drop into any MCP-compatible client |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest |
| `gemini-extension.json` | Gemini CLI extension manifest (same remote MCP server) |
| `skills/volai/SKILL.md` | Full API and MCP reference for AI agents |
| `examples/make-call.mjs` | Minimal Node.js script that places a trial voice-agent call over the REST API |
| `examples/send-sms.mjs` | Minimal Node.js script that sends an SMS over the REST API |

## Install the MCP server

volai's MCP server is remote (streamable HTTP) - there is nothing to
build or run locally.

### Claude Code (plugin with the bundled skill)

```bash
claude plugin marketplace add https://volai.cz/.claude-plugin/marketplace.json
claude plugin install volai@volai
export VOLAI_API_KEY=vk_YOUR_KEY
```

### Claude Code (MCP server only)

```bash
claude mcp add --transport http volai https://volai.cz/mcp \
  --header "Authorization: Bearer vk_YOUR_KEY"
```

### Gemini CLI

```bash
gemini extensions install https://github.com/radekklein92/volai-plugin
export VOLAI_API_KEY=vk_YOUR_KEY
```

### Cursor, Windsurf and other MCP clients

Add this to your MCP config (same shape as [`.mcp.json`](./.mcp.json) in
this repo):

```json
{
  "mcpServers": {
    "volai": {
      "type": "http",
      "url": "https://volai.cz/mcp",
      "headers": {
        "Authorization": "Bearer vk_YOUR_KEY"
      }
    }
  }
}
```

Per-client walkthroughs (Cursor, Windsurf, Claude Desktop, n8n, Make,
Lovable): [volai.cz/en/integrations](https://volai.cz/en/integrations).

Get `vk_YOUR_KEY` in the volai portal under **API and MCP**
([volai.cz/en/api-and-mcp](https://volai.cz/en/api-and-mcp)) after
signing up at [volai.cz/en/auth/signup](https://volai.cz/en/auth/signup).
Treat the key like a password - anyone who has it can spend your credit.

31 tools cover phone numbers, outbound and inbound calls, SMS, voice
agents and webhooks. Full tool list: [`skills/volai/SKILL.md`](./skills/volai/SKILL.md).

## REST API

Same account, same API key, same data as the MCP server - a good fit for
your own backend. Example (Node.js 20+, no dependencies):

```bash
VOLAI_API_KEY=vk_... node examples/send-sms.mjs +420777123456 "Hello from volai"
VOLAI_API_KEY=vk_... node examples/make-call.mjs +420777123456 \
  "You are a friendly receptionist for a small cafe. Ask what the caller needs."
```

Full reference: [volai.cz/en/docs](https://volai.cz/en/docs).

## License

MIT - see [LICENSE](./LICENSE). This repository is a plugin/config
package and a set of examples; volai itself is a hosted SaaS
([volai.cz](https://volai.cz)), operated by ANOVIA Finance s.r.o.

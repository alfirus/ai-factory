# AI Factory

A local MCP server that gives [OpenCode](https://opencode.ai/) access to your paid AI subscriptions — Google Gemini, GitHub Copilot, and Anthropic Claude — through a unified interface.

## Features

- **`ai_chat`** — Send a prompt to Gemini, Copilot, or Claude
- **`ai_compare`** — Compare responses from multiple providers side by side
- **`ai_review`** — Code review by a selected model (bugs, security, perf, style)

## Prerequisites

- Node.js >= 20
- [OpenCode](https://opencode.ai/) installed
- At least one provider configured below

---

## Getting Your API Keys

### Google Gemini

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API key** in the left sidebar
4. Click **Create API key**, select or create a Google Cloud project
5. Copy the generated key (looks like `AIzaSy...`)

- Free tier available with rate limits
- Paid usage billed through your Google Cloud project
- Pricing: [ai.google.dev/pricing](https://ai.google.dev/pricing)
- Models: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

### Anthropic Claude

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Go to **Settings > API keys** ([direct link](https://console.anthropic.com/settings/keys))
4. Click **Create Key**, name it (e.g. `ai-factory`), copy the key (looks like `sk-ant-api03-...`)

- No free tier — add payment method under **Settings > Billing** first
- Pricing: [anthropic.com/pricing](https://www.anthropic.com/pricing#anthropic-api)
- Models: `claude-opus-4-5-20251101`, `claude-sonnet-4-20250514`, `claude-haiku-3-5-20241022`

### GitHub Copilot

Copilot has no official public completions API. This project uses [copilot-api](https://github.com/ericc-ch/copilot-api), a reverse-engineered proxy that exposes Copilot as an OpenAI-compatible local server.

1. Have an active [GitHub Copilot subscription](https://github.com/features/copilot) (Individual, Business, or Enterprise)

2. Install and authenticate [GitHub CLI](https://cli.github.com/):
   ```bash
   brew install gh     # macOS
   gh auth login       # follow browser prompts
   ```

3. Start the proxy:
   ```bash
   npx copilot-api
   ```
   Runs on `http://localhost:4141` by default. No manual API key needed.

- Models available through Copilot: `gpt-4o`, `claude-3.5-sonnet`, etc.
- **Warning:** This is unofficial. Excessive automated usage may trigger GitHub abuse detection.

---

## Setup

```bash
npm install
cp .env.example .env   # fill in your keys
npm run build
```

### Environment Variables

```bash
# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_DEFAULT_MODEL=gemini-2.5-flash              # optional

# Anthropic Claude
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514    # optional

# GitHub Copilot (via copilot-api proxy)
COPILOT_API_PORT=4141                               # optional
COPILOT_DEFAULT_MODEL=gpt-4o                        # optional
```

Only configure the providers you plan to use.

---

## OpenCode Configuration

Add to `opencode.json` (project root or `~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ai-factory": {
      "type": "local",
      "command": ["node", "/absolute/path/to/ai-factory/dist/index.js"],
      "environment": {
        "GEMINI_API_KEY": "your-gemini-api-key",
        "ANTHROPIC_API_KEY": "your-anthropic-api-key",
        "COPILOT_API_PORT": "4141"
      },
      "enabled": true
    }
  }
}
```

## Usage

```
> Use ai_chat to ask Gemini to suggest a caching strategy for this API

> Use ai_compare to get opinions from all three models on this database schema

> Use ai_review with Claude to review the auth module for security issues
```

## Development

```bash
npm run dev                                                    # dev mode
npx @modelcontextprotocol/inspector node dist/index.js         # test with MCP Inspector
```

## License

MIT
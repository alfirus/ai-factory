# Quick Start Guide - AI Factory

Get up and running with AI Factory in 5 minutes.

## Prerequisites

- Node.js 20+
- At least one AI provider API key (Gemini, Claude, or Copilot)
- OpenCode (optional, for integration)

## 1. Install

```bash
cd ai-factory
npm install
npm run build
```

## 2. Configure

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```bash
# Required: at least one of these
GEMINI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Optional: for Copilot
COPILOT_API_PORT=4141

# Optional: for brain integration
AI_BRAIN_PATH=/path/to/ai-brain
```

## 3. Test Locally

### MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Then interact with the server:
- Click on `ai_list` to see configured providers
- Click on `ai_chat` to send a prompt
- Test `ai_compare` and `ai_review`

### Direct Testing (requires valid keys)

Create a test script:
```javascript
// test.js
import { startServer, server } from './dist/server.js';
import { registerAllProviders, getProvider } from './dist/providers/index.js';

registerAllProviders();
const claude = getProvider('claude');
const response = await claude.chat('What is 2+2?');
console.log(response);
```

Run:
```bash
node test.js
```

## 4. Use with OpenCode

Create `opencode.json` in your project:

```json
{
  "mcpServers": {
    "ai-factory": {
      "command": "node",
      "args": ["/absolute/path/to/ai-factory/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key",
        "ANTHROPIC_API_KEY": "your-anthropic-key",
        "AI_BRAIN_PATH": "/path/to/ai-brain"
      }
    }
  }
}
```

Restart OpenCode. Now you can use:

```
> Use ai_chat with provider claude to design an API

> Use ai_compare to get opinions from all providers

> Use ai_review to check this code for bugs (provider: gemini)
```

## 5. Enable HTTP Server (Optional)

For remote access:

```bash
TRANSPORT=http HTTP_PORT=3000 npm start
```

Access endpoints:
- `GET http://localhost:3000/health` — Health check
- `GET http://localhost:3000/providers` — Provider status
- `POST http://localhost:3000/mcp` — MCP requests

Add authentication:
```bash
AUTH_TOKEN=my-secret TRANSPORT=http npm start
```

Then include header:
```bash
curl -H "Authorization: Bearer my-secret" http://localhost:3000/health
```

## 6. AI Brain Integration (Optional)

### Create Brain Directory

```
ai-brain/
├── personas/
│   └── default.md          # Your default persona
├── rules/
│   └── core.md            # Development rules
└── knowledge/
    ├── patterns.md
    ├── best-practices.md
    └── architecture/
        └── microservices.md
```

### Set Path

```bash
export AI_BRAIN_PATH=/path/to/ai-brain
npm start
```

### Use Brain Context

```
> Use ai_chat to design an API
  (Automatically includes your persona + rules)

> Use ai_brain_chat with knowledge_query "microservices" to design a system
  (Searches knowledge base automatically)
```

## 7. Get API Keys

### Google Gemini
1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Click **Get API key**
3. Create a key for existing or new project
4. Copy the key to `GEMINI_API_KEY`

**Free tier** with rate limits. Pricing: ~$0.075/million input tokens

### Anthropic Claude
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Go to **Settings > API keys**
3. Click **Create Key**
4. Copy to `ANTHROPIC_API_KEY`

**No free tier** - add payment method first. Pricing: ~$0.003/token input

### GitHub Copilot
1. Have an active GitHub Copilot subscription
2. Install GitHub CLI: `brew install gh`
3. Authenticate: `gh auth login`
4. Install proxy: `npm install -g copilot-api`
5. Start proxy: `copilot-api`

---

## Troubleshooting

**"Provider not found"**
- Verify `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or Copilot proxy is running

**"Request timeout"**
- Check API key validity
- Try increasing `REQUEST_TIMEOUT_MS` (default 30000ms)

**"Brain not available"**
- Set `AI_BRAIN_PATH` to a valid directory
- Verify directory structure with `personas/default.md` and `rules/core.md`

**"Cannot find module"**
- Run `npm install` and `npm run build`
- Ensure Node.js >= 20

---

## Next Steps

- Read [README.md](README.md) for full feature documentation
- Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for architecture details
- View [docs/tasks.md](docs/tasks.md) for implementation status
- Explore [docs/plan.md](docs/plan.md) for original design

---

**Questions?** Check the source code - it's well-commented! Start with `src/server.ts` to understand the tool implementations.

# AI Factory

A local MCP server that gives [OpenCode](https://opencode.ai/) access to your paid AI subscriptions — Google Gemini, GitHub Copilot, and OpenAI ChatGPT — through a unified interface.

## Features

### Phase 1 - Core (Standalone)
- **`ai_chat`** — Multi-turn conversation with a single provider
- **`ai_compare`** — Side-by-side comparison of responses from multiple providers
- **`ai_review`** — Code review with focus options (bugs, security, perf, style)
- **`ai_list`** — Display configured providers and their status
- **`providers://status`** — MCP Resource showing provider configuration

### Phase 2 & 3 - AI Brain Integration
- **`ai_brain_chat`** — Chat with AI Brain context (persona, rules, knowledge)
- **Auto-injection** — `ai_chat` automatically includes brain context when available
- **Knowledge Search** — Query your AI Brain knowledge base
- **Deep Integration** — Load personas and rules from your AI Brain

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

### OpenAI ChatGPT

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Go to **API keys** ([direct link](https://platform.openai.com/api-keys))
4. Click **Create new secret key**, name it (e.g. `ai-factory`), copy the key (looks like `sk-proj-...`)

- No free tier — add payment method under **Billing** first
- Pricing: [openai.com/pricing](https://openai.com/pricing)
- Models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-preview`

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

# OpenAI ChatGPT
OPENAI_API_KEY=your-openai-api-key
OPENAI_DEFAULT_MODEL=gpt-4o                        # optional

# GitHub Copilot (via copilot-api proxy)
COPILOT_API_PORT=4141                               # optional
COPILOT_DEFAULT_MODEL=gpt-4o                        # optional

# AI Brain Integration (Phase 2/3)
AI_BRAIN_PATH=/path/to/your/ai-brain                # optional
LOG_LEVEL=info                                       # debug, info, warn, error
REQUEST_TIMEOUT_MS=30000                             # optional
```

Only configure the providers you plan to use.

---

## Phase 1: Standalone Usage

### Tools

#### `ai_chat`
Multi-turn conversation with history.

```
provider: "gemini" | "openai" | "copilot" (required)
prompt: string (required)
model: string (optional - overrides default model)
system_prompt: string (optional)
conversation_id: string (optional - for multi-turn)
temperature: 0-1 (optional)
max_tokens: number (optional)
```

Example:
```
> Use ai_chat with provider "openai" to explain this algorithm
> openai-id: abc123 (conversation stored, follow-up will reference it)
```

#### `ai_compare`
Compare responses from multiple providers.

```
prompt: string (required)
providers: ["gemini", "openai", "copilot"] (optional - defaults to all available)
system_prompt: string (optional)
temperature: 0-1 (optional)
max_tokens: number (optional)
```

Example:
```
> Use ai_compare to get all three models' opinions on this REST API design
```

#### `ai_review`
Code review focused on specific areas.

```
provider: "gemini" | "openai" | "copilot" (required)
code: string (required)
language: string (optional - e.g., "python", "typescript")
focus: "bugs" | "security" | "perf" | "style" | "all" (optional - defaults to "all")
temperature: 0-1 (optional)
max_tokens: number (optional)
```

Example:
```
> Use ai_review with provider openai to check this code for security issues (language: typescript)
```

#### `ai_list`
Show configured providers and their status.

```
> Use ai_list to see which providers are configured
```

---

## Phase 2 & 3: AI Brain Integration

AI Factory can integrate with **AI Brain** — a companion MCP server that manages your development knowledge base.

### Setting Up AI Brain Context

1. Create an `ai-brain` directory with this structure:
   ```
   ai-brain/
     personas/
       default.md         # Your default development persona
     rules/
       core.md           # Your core development rules
     knowledge/
       best-practices.md
       patterns/
         architectural.md
   ```

2. Set the path in your environment:
   ```bash
   export AI_BRAIN_PATH=/path/to/ai-brain
   ```

3. Optional: Run AI Brain MCP alongside AI Factory:
   ```json
   {
     "mcpServers": {
       "ai-factory": {...},
       "ai-brain": {
         "command": "node",
         "args": ["/path/to/ai-brain/dist/index.js"]
       }
     }
   }
   ```

### Features

#### Auto-Injection (Phase 3.2)
When `AI_BRAIN_PATH` is set and no explicit `system_prompt` is provided, `ai_chat` automatically injects:
- Your default persona
- Your core development rules

This applies contextual expertise to every conversation.

Example:
```
With AI_BRAIN_PATH set:
> Use ai_chat with provider openai to design an auth system
  ↓
OpenAI automatically gets your persona + rules as context
```

Override with explicit `system_prompt` to skip auto-injection:
```
> Use ai_chat with provider gemini and system_prompt "you are a security expert" to design an auth system
  ↓
Only the provided prompt is used (no brain context)
```

#### `ai_brain_chat` (Phase 3.3)
Selectively load brain modules for a single request.

```
provider: "gemini" | "openai" | "copilot" (required)
prompt: string (required)
model: string (optional)
persona: string (optional - defaults to "default")
brain_modules: ["persona" | "rules" | "knowledge"] (optional)
knowledge_query: string (optional - search knowledge base)
temperature: 0-1 (optional)
max_tokens: number (optional)
```

Example:
```
> Use ai_brain_chat with provider openai, modules ["persona", "rules", "knowledge"] and knowledge_query "database migration" to design a migration strategy
```

#### Knowledge Search (Phase 3.4)
The `knowledge_query` parameter searches your knowledge base for relevant files.

Example:
```
> Use ai_brain_chat with provider gemini, modules ["knowledge"] and knowledge_query "docker" to containerize this application
  ↓
Searches knowledge/ for files mentioning "docker"
Includes matches in system prompt
```

---

## Advanced Configuration

### Combined OpenCode Setup (Phase 2)

Run AI Factory and AI Brain together:

```json
{
  "mcpServers": {
    "ai-factory": {
      "command": "node",
      "args": ["/path/to/ai-factory/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "...",
        "OPENAI_API_KEY": "...",
        "AI_BRAIN_PATH": "/path/to/ai-brain"
      }
    },
    "ai-brain": {
      "command": "node",
      "args": ["/path/to/ai-brain/dist/index.js"],
      "env": {
        "BRAIN_PATH": "/path/to/ai-brain"
      }
    }
  }
}
```

### Example Workflows

**Workflow 1: Auto-Injected Context**
```
With AI_BRAIN_PATH set:
1. > Use ai_chat with provider openai to design the API
2. OpenAI gets your persona + rules automatically
3. Response reflects your development philosophy
```

**Workflow 2: Selective Brain Modules**
```
> Use ai_brain_chat with provider gemini, modules ["knowledge"], knowledge_query "testing" to review this test file
1. Searches knowledge/ for testing resources
2. Loads only knowledge (not persona/rules)
3. Provides targeted expertise
```

**Workflow 3: Comparison with Context**
```
> Use ai_compare to get opinions on this architecture (system_prompt from brain)
1. All three models get your architectural persona
2. Responses are tailored to your preferences
3. Consistent perspective across providers
```

---

## Phase 4: Optional Enhancements

### HTTP Transport (Remote Deployment)

AI Factory supports both stdio (default, local) and HTTP (remote) transports.

#### Enable HTTP Mode

Set the `TRANSPORT` environment variable:

```bash
TRANSPORT=http HTTP_PORT=3000 npm start
```

#### HTTP Endpoints

- **GET `/health`** — Health check
  ```bash
  curl http://localhost:3000/health
  ```

- **GET `/providers`** — List provider status (JSON)
  ```bash
  curl http://localhost:3000/providers
  ```

- **POST `/mcp`** — MCP request handler
  ```bash
  curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -d '{"method": "tools/list"}'
  ```

#### Authentication (Optional)

Set `AUTH_TOKEN` to require Bearer token authentication:

```bash
AUTH_TOKEN=secret-token TRANSPORT=http npm start
```

All requests must include:
```
Authorization: Bearer secret-token
```

#### Remote OpenCode Config

Use with OpenCode remote MCP configuration:

```json
{
  "mcpServers": {
    "ai-factory": {
      "type": "remote",
      "url": "http://your-server:4000",
      "auth": {
        "type": "bearer",
        "token": "secret-token"
      }
    }
  }
}
```

---

## Development

```bash
npm run dev                                                    # dev mode
npx @modelcontextprotocol/inspector node dist/index.js         # test with MCP Inspector
```

## License

MIT
# AI Factory - MCP Server Implementation Plan

An MCP (Model Context Protocol) server that exposes Google Gemini, GitHub Copilot, and OpenAI ChatGPT as tools for [OpenCode](https://opencode.ai/).

---

## 1. Overview

### What This MCP Server Does

AI Factory is a local MCP server that acts as a unified gateway to your paid AI subscriptions. When connected to OpenCode, it gives the coding agent access to three additional AI models as tools — enabling multi-model workflows such as:

- Asking Gemini for a second opinion on a code approach
- Using Copilot for code completions and suggestions
- Delegating complex reasoning tasks to ChatGPT/OpenAI
- Comparing responses across models for the same prompt

### Architecture

```
OpenCode (MCP Client)
    |
    | stdio (JSON-RPC)
    |
AI Factory MCP Server (Node.js)
    |
    +--- Google Gemini API (REST / @google/genai SDK)
    +--- GitHub Copilot API (copilot-api proxy or Copilot SDK)
    +--- OpenAI ChatGPT API (REST / openai SDK)
```

### Tech Stack

| Component            | Choice                                           |
| -------------------- | ------------------------------------------------ |
| Runtime              | Node.js (>=20)                                   |
| Language             | TypeScript (ESM)                                 |
| MCP SDK              | `@modelcontextprotocol/sdk` v1.x                 |
| Transport            | stdio (recommended for local MCP in OpenCode)    |
| Schema Validation    | `zod` (required peer dependency of MCP SDK)      |
| Gemini Client        | `@google/genai` SDK                              |
| OpenAI Client        | `openai` SDK                                     |
| Copilot Client       | `copilot-api` (reverse-engineered OpenAI-compat) |
| Build                | `tsup` or `tsc`                                  |
| Package Manager      | `npm` or `pnpm`                                  |

---

## 2. Project Structure

```
ai-factory/
  docs/
    plan.md                  # This file
  src/
    index.ts                 # Entry point - MCP server bootstrap
    server.ts                # MCP server definition & tool registration
    providers/
      base.ts                # Shared provider interface & registry
      gemini.ts              # Google Gemini provider
      copilot.ts             # GitHub Copilot provider
      openai.ts              # OpenAI ChatGPT provider
      index.ts               # Auto-registers all providers
    tools/
      chat.ts                # chat tool (send prompt to a provider)
      compare.ts             # compare tool (send prompt to all, return side-by-side)
      review.ts              # review tool (code review via selected model)
      list.ts                # list tool (show configured providers & status)
      prompts.ts             # Shared prompt builders (e.g. buildReviewPrompt)
    utils/
      config.ts              # Environment variable loading & validation
      errors.ts              # Standardized error handling
      logger.ts              # Structured stderr logging (stdout reserved for MCP)
      timeout.ts             # Per-request timeout wrapper
  .env.example               # Template for required env vars
  .gitignore                 # Ignore .env, node_modules, dist
  package.json
  tsconfig.json
  README.md                  # Setup & usage instructions
```

---

## 3. Provider Integration Details

### 3.1 Google Gemini

**Authentication:** API key via `GEMINI_API_KEY` env var.

**SDK:** `@google/genai` (official Google Gen AI SDK)

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/`

**Supported Models:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, etc.

**Implementation:**

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function chat(model: string, prompt: string, systemPrompt?: string) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });
  return response.text;
}
```

**Alternative:** Google also exposes an OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, which could be used as a fallback.

### 3.2 GitHub Copilot

**Authentication:** GitHub OAuth token (from your Copilot subscription).

**Access Strategy:** GitHub does not yet offer an official public completions API. There are two options:

| Option                        | Pros                                 | Cons                                         |
| ----------------------------- | ------------------------------------ | -------------------------------------------- |
| `copilot-api` (reverse-eng.)  | Works now, OpenAI-compatible format  | Unofficial, may break, abuse-detection risk  |
| Copilot SDK (technical preview) | Official, multi-turn support       | Preview stage, API surface may change        |

**Recommended:** Use `copilot-api` for immediate functionality, with an abstraction layer that allows swapping to the official SDK once it stabilizes.

**Implementation (via copilot-api):**

The `copilot-api` project exposes Copilot as an OpenAI-compatible HTTP server locally. The MCP server would:

1. Spawn `copilot-api` as a child process (or assume it's running)
2. Call `http://localhost:{port}/v1/chat/completions` with the OpenAI format

```typescript
import OpenAI from "openai";

const copilot = new OpenAI({
  baseURL: `http://localhost:${process.env.COPILOT_API_PORT || 4141}`,
  apiKey: "copilot", // copilot-api doesn't require a real key
});

async function chat(model: string, prompt: string, systemPrompt?: string) {
  const response = await copilot.chat.completions.create({
    model, // e.g. "gpt-4o", "claude-3.5-sonnet" (Copilot-provided models)
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user" as const, content: prompt },
    ],
  });
  return response.choices[0].message.content;
}
```

**Note:** Users must have an active GitHub Copilot subscription (Individual, Business, or Enterprise) and be authenticated via `gh auth login`.

### 3.3 OpenAI ChatGPT

**Authentication:** API key via `OPENAI_API_KEY` env var.

**SDK:** `openai` (official OpenAI SDK)

**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Supported Models:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-preview`, etc.

**Implementation:**

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chat(model: string, prompt: string, systemPrompt?: string) {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt || "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
  });
  return response.choices[0]?.message?.content || "";
}
```

---

## 4. MCP Tools Definition

### 4.1 `ai_chat` - Send a prompt to a specific provider

| Parameter       | Type   | Required | Description                                  |
| --------------- | ------ | -------- | -------------------------------------------- |
| `provider`      | enum   | Yes      | `"gemini"`, `"copilot"`, or `"claude"`       |
| `prompt`        | string | Yes      | The user prompt / question                   |
| `model`         | string | No       | Override the default model for the provider  |
| `system_prompt` | string | No       | System-level instruction                     |
| `conversation_id` | string | No     | Resume a previous conversation by its ID     |
| `temperature`   | number | No       | Sampling temperature (0.0–2.0, default 1.0)  |
| `max_tokens`    | number | No       | Maximum tokens in the response               |

**Returns:** The model's text response.

### 4.2 `ai_compare` - Compare responses across providers

| Parameter       | Type     | Required | Description                                        |
| --------------- | -------- | -------- | -------------------------------------------------- |
| `prompt`        | string   | Yes      | The prompt to send to all providers                |
| `providers`     | string[] | No       | Subset of providers (defaults to all enabled)      |
| `system_prompt` | string   | No       | System-level instruction                           |
| `temperature`   | number   | No       | Sampling temperature applied to all providers      |
| `max_tokens`    | number   | No       | Maximum tokens in the response                     |

**Returns:** A structured comparison with each provider's response side by side. Stateless — no conversation history (one-shot by design).

### 4.3 `ai_review` - Code review by a selected model

| Parameter       | Type   | Required | Description                                  |
| --------------- | ------ | -------- | -------------------------------------------- |
| `provider`      | enum   | Yes      | `"gemini"`, `"copilot"`, or `"openai"`       |
| `code`          | string | Yes      | The code to review                           |
| `language`      | string | No       | Programming language (for context)           |
| `focus`         | string | No       | Review focus: "bugs", "security", "perf", "style", or "all" |
| `temperature`   | number | No       | Sampling temperature (0.0–2.0, default 1.0)  |
| `max_tokens`    | number | No       | Maximum tokens in the response               |

**Returns:** Structured review feedback. Stateless — each review evaluates code on its own merit.

### 4.4 `ai_list` - List available providers and their status

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| (none)    |      |          |             |

**Returns:** A list of all providers showing: name, whether configured (API key present), default model, and available models.

Example output:

```
| Provider | Status      | Default Model        |
| -------- | ----------- | -------------------- |
| gemini   | configured  | gemini-2.5-flash     |
| claude   | configured  | claude-sonnet-4-...  |
| copilot  | unavailable | -                    |
```

### 4.5 Prompt Builder — `buildReviewPrompt()`

Referenced by `ai_review`, this function lives in `src/tools/prompts.ts`:

```typescript
export function buildReviewPrompt(
  code: string,
  language?: string,
  focus?: "bugs" | "security" | "perf" | "style" | "all"
): string {
  const lang = language ? ` (${language})` : "";
  const focusMap: Record<string, string> = {
    bugs: "Focus on bugs, logic errors, and edge cases.",
    security: "Focus on security vulnerabilities (injection, XSS, auth issues, secrets).",
    perf: "Focus on performance bottlenecks, unnecessary allocations, and complexity.",
    style: "Focus on code style, naming, readability, and idiomatic patterns.",
    all: "Cover bugs, security, performance, and code style.",
  };
  const instruction = focusMap[focus || "all"];

  return `Review the following code${lang}. ${instruction}

For each issue found, provide:
1. The problematic line or section
2. What the issue is
3. A suggested fix

If the code looks good, say so — do not invent problems.

\`\`\`${language || ""}
${code}
\`\`\``;
}

---

## 5. MCP Server Implementation

### 5.1 Entry Point (`src/index.ts`)

```typescript
#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Failed to start AI Factory MCP server:", err);
  process.exit(1);
});
```

### 5.2 Server Definition (`src/server.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import crypto from "node:crypto";
import { z } from "zod";
import { getProvider } from "./providers/base.js";

export async function startServer() {
  const server = new McpServer({
    name: "ai-factory",
    version: "1.0.0",
  });

  // Register ai_chat tool
  server.tool(
    "ai_chat",
    "Send a prompt to Google Gemini, GitHub Copilot, or OpenAI ChatGPT",
    {
      provider: z.enum(["gemini", "copilot", "claude"]),
      prompt: z.string().describe("The prompt to send"),
      model: z.string().optional().describe("Override default model"),
      system_prompt: z.string().optional().describe("System instruction"),
      conversation_id: z.string().optional().describe("Resume a previous conversation by ID"),
      temperature: z.number().optional().describe("Sampling temperature"),
      max_tokens: z.number().optional().describe("Max tokens in the response"),
    },
    async ({ provider, prompt, model, system_prompt, conversation_id, temperature, max_tokens }) => {
      const p = getProvider(provider);
      const convoId = conversation_id || crypto.randomUUID();
      const history = getConversation(convoId, provider);
      history.push({ role: "user", content: prompt });

      const result = await p.chat(history, {
        model,
        systemPrompt: system_prompt,
        temperature,
        maxTokens: max_tokens,
      });

      history.push({ role: "assistant", content: result });
      setConversation(convoId, provider, history);

      return {
        content: [{ type: "text", text: result }],
        meta: { conversation_id: convoId },
      };
    }
  );

  // Register ai_compare tool (stateless — no conversation history)
  server.tool(
    "ai_compare",
    "Compare responses from multiple AI providers for the same prompt",
    {
      prompt: z.string(),
      providers: z.array(z.enum(["gemini", "copilot", "openai"])).optional(),
      system_prompt: z.string().optional(),
      temperature: z.number().optional(),
      max_tokens: z.number().optional(),
    },
    async ({ prompt, providers, system_prompt, temperature, max_tokens }) => {
      const targets = providers || ["gemini", "copilot", "openai"];
      const results = await Promise.allSettled(
        targets.map(async (name) => {
          const p = getProvider(name);
          const response = await p.chat(prompt, {
            systemPrompt: system_prompt,
            temperature,
            maxTokens: max_tokens,
          });
          return { provider: name, response };
        })
      );
      const output = results.map((r, i) => {
        if (r.status === "fulfilled") return `## ${r.value.provider}\n\n${r.value.response}`;
        return `## ${targets[i]}\n\nError: ${r.reason}`;
      });
      return {
        content: [{ type: "text", text: output.join("\n\n---\n\n") }],
      };
    }
  );

  // Register ai_review tool (stateless — no conversation history)
  server.tool(
    "ai_review",
    "Get a code review from a specific AI provider",
    {
      provider: z.enum(["gemini", "copilot", "claude"]),
      code: z.string().describe("Code to review"),
      language: z.string().optional().describe("Programming language"),
      focus: z.enum(["bugs", "security", "perf", "style", "all"]).optional(),
      temperature: z.number().optional(),
      max_tokens: z.number().optional(),
    },
    async ({ provider, code, language, focus, temperature, max_tokens }) => {
      const p = getProvider(provider);
      const reviewPrompt = buildReviewPrompt(code, language, focus);
      const result = await p.chat(reviewPrompt, {
        systemPrompt: "You are an expert code reviewer. Provide actionable, specific feedback.",
        temperature,
        maxTokens: max_tokens,
      });
      return {
        content: [{ type: "text", text: result }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 5.3 Provider Interface (`src/providers/base.ts`)

```typescript
export interface ChatOptions {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIProvider {
  name: string;
  defaultModel: string;
  isAvailable(): boolean;
  chat(messages: string | ChatMessage[], options?: ChatOptions): Promise<string>;
}

// Provider registry
const providers: Record<string, AIProvider> = {};

export function registerProvider(provider: AIProvider) {
  providers[provider.name] = provider;
}

export function getProvider(name: string): AIProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Provider "${name}" is not registered`);
  if (!provider.isAvailable()) throw new Error(`Provider "${name}" is not configured (missing API key)`);
  return provider;
}

export function getAllProviders(): AIProvider[] {
  return Object.values(providers);
}
```

### 5.4 Provider Auto-Registration (`src/providers/index.ts`)

Each provider file exports a class. This module instantiates and registers them at startup:

```typescript
import { registerProvider } from "./base.js";
import { GeminiProvider } from "./gemini.js";
import { ClaudeProvider } from "./claude.js";
import { CopilotProvider } from "./copilot.js";

export function registerAllProviders() {
  registerProvider(new GeminiProvider());
  registerProvider(new ClaudeProvider());
  registerProvider(new CopilotProvider());
}
```

Called from `server.ts` before tool registration:

```typescript
import { registerAllProviders } from "./providers/index.js";

export async function startServer() {
  registerAllProviders();
  // ... tool registration follows
}
```

### 5.5 Timeout Wrapper (`src/utils/timeout.ts`)

Prevents a hung provider from blocking the MCP server indefinitely:

```typescript
const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_TIMEOUT_MS,
  label?: string
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label || "Request"} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
```

Used inside each provider's `chat()` method:

```typescript
async chat(messages: string | ChatMessage[], options?: ChatOptions): Promise<string> {
  return withTimeout(
    this.callAPI(messages, options),
    60_000,
    `${this.name} chat`
  );
}
```

### 5.6 Logging (`src/utils/logger.ts`)

MCP uses stdout for JSON-RPC, so all logs go to **stderr**:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...data,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}
```

---

## 6. MCP Resources

In addition to tools, MCP supports **Resources** — read-only data the client can inspect. AI Factory exposes one resource:

### 6.1 `providers://status` — Provider health & configuration

Returns a JSON summary of all providers without making any API calls:

```typescript
server.resource(
  "providers://status",
  "Current status of all configured AI providers",
  async () => {
    const providers = getAllProviders();
    const status = providers.map((p) => ({
      name: p.name,
      configured: p.isAvailable(),
      defaultModel: p.isAvailable() ? p.defaultModel : null,
    }));
    return {
      contents: [{
        uri: "providers://status",
        mimeType: "application/json",
        text: JSON.stringify(status, null, 2),
      }],
    };
  }
);
```

This lets OpenCode (or any MCP client) check provider status before calling tools.

---

## 7. Conversation History (`ai_chat` only)

Conversation history is scoped to **`ai_chat` only**. The other tools are stateless by design:

- **`ai_compare`** — one-shot; comparing across providers doesn't benefit from accumulated history, and it would multiply token cost across all providers.
- **`ai_review`** — one-shot; each review should evaluate code on its own merit. Follow-up discussion about a review can happen via `ai_chat`.

`ai_chat` accepts an optional `conversation_id`. When provided, the server appends the new prompt to an in-memory history and sends the full message array to the provider. A `conversation_id` is returned in response metadata for the client to pass back on the next call.

```typescript
// In-memory conversation store (lives for the MCP server's lifetime)
const conversations = new Map<string, Array<{ role: "system" | "user" | "assistant"; content: string }>>();

function getConversation(conversationId: string, provider: string) {
  return conversations.get(`${conversationId}:${provider}`) || [];
}

function setConversation(conversationId: string, provider: string, history: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  conversations.set(`${conversationId}:${provider}`, history);
}

// Inside ai_chat handler:
const convoId = conversation_id || crypto.randomUUID();
const history = getConversation(convoId, provider);
history.push({ role: "user", content: prompt });

const result = await provider.chat(history, options);

history.push({ role: "assistant", content: result });
setConversation(convoId, provider, history);

return {
  content: [{ type: "text", text: result }],
  meta: { conversation_id: convoId },
};
```

The provider interface accepts both a plain string (used by `ai_compare`, `ai_review`) and a message array (used by `ai_chat` with history):

```typescript
export interface AIProvider {
  // ... existing members
  chat(prompt: string | ChatMessage[], options?: ChatOptions): Promise<string>;
}
```

Conversations are stored in memory and cleared when the MCP server process exits — no persistence needed for a local stdio server.

---

## 8. Environment Variables

```bash
# .env.example

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_DEFAULT_MODEL=gemini-2.5-flash            # optional

# Anthropic Claude
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20250514  # optional

# GitHub Copilot (via copilot-api proxy)
COPILOT_API_PORT=4141                             # optional, default 4141
COPILOT_DEFAULT_MODEL=gpt-4o                      # optional

# Server
LOG_LEVEL=info                                    # optional: debug, info, warn, error
REQUEST_TIMEOUT_MS=60000                          # optional: per-request timeout
```

### `.gitignore`

```
node_modules/
dist/
.env
*.tsbuildinfo
```

---

## 9. OpenCode Integration

### 9.1 AI Factory Only (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ai-factory": {
      "type": "local",
      "command": ["node", "/path/to/ai-factory/dist/index.js"],
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

### 9.2 Combined: AI Factory + AI Brain MCP (Recommended)

Both servers run **side by side** in OpenCode, giving the agent multi-model AI access plus persistent memory, knowledge, rules, skills, and personas:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ai-factory": {
      "type": "local",
      "command": ["node", "/path/to/ai-factory/dist/index.js"],
      "environment": {
        "GEMINI_API_KEY": "your-gemini-api-key",
        "ANTHROPIC_API_KEY": "your-anthropic-api-key",
        "COPILOT_API_PORT": "4141"
      }
    },
    "ai-brain": {
      "type": "local",
      "command": [
        "/path/to/code-master-ai-brain-mcp/venv/bin/python",
        "/path/to/code-master-ai-brain-mcp/server.py"
      ]
    }
  }
}
```

**What OpenCode gains from each:**

| MCP Server   | Tools | What It Provides                                                 |
| ------------ | ----- | ---------------------------------------------------------------- |
| AI Factory   | ~5    | `ai_chat`, `ai_compare`, `ai_review`, `ai_list`                 |
| AI Brain     | ~22   | `brain_save_memory`, `brain_search_knowledge`, `brain_get_applicable_rules`, `brain_list_skills`, `brain_load_persona`, etc. |

**Example combined workflows in OpenCode:**

```
> Load the default persona from ai-brain, then use ai_chat to ask
  Gemini to review this code while following those persona traits

> Search knowledge with brain_search_knowledge for "auth patterns",
  then use ai_compare to get all three models' opinions on which
  pattern fits best

> After implementing a feature, use ai_review with OpenAI, then
  brain_save_memory to persist the review feedback for next session

> Load rules with brain_get_applicable_rules, then pass them as
  system_prompt to ai_chat so Gemini follows your coding standards
```

### 9.3 Context Budget Warning

Running two MCP servers adds tool definitions to every OpenCode request. With ~27 tools total, this consumes context. Mitigations:

- Keep tool descriptions short (already done in both servers)
- Disable servers you don't need via `"enabled": false`
- OpenCode shows a warning when tools approach the context limit

---

## 10. Build Steps

### Step 1: Initialize Project

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod @google/genai @anthropic-ai/sdk openai dotenv
npm install -D typescript @types/node tsup
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### Step 3: Add Build Scripts

```json
// package.json (partial)
{
  "type": "module",
  "bin": {
    "ai-factory": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  }
}
```

### Step 4: Implement Providers (see Section 3)

### Step 5: Implement Tools (see Section 4)

### Step 6: Wire Up Server (see Section 5)

### Step 7: Build & Test

```bash
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## 11. Implementation Order

### Phase 1 — Core (AI Factory standalone)

| Step | Task                                                     | Priority |
| ---- | -------------------------------------------------------- | -------- |
| 1    | Project scaffolding (package.json, tsconfig, .gitignore) | High     |
| 2    | Provider interface, registry, and auto-registration      | High     |
| 3    | Gemini provider                                          | High     |
| 4    | OpenAI provider                                          | High     |
| 5    | MCP server with `ai_chat` + `ai_list` tools              | High     |
| 6    | Timeout wrapper + stderr logging                         | High     |
| 7    | Copilot provider (via copilot-api)                       | Medium   |
| 8    | `ai_compare` tool                                        | Medium   |
| 9    | `ai_review` tool + `buildReviewPrompt`                   | Medium   |
| 10   | MCP Resource (`providers://status`)                      | Medium   |
| 11   | Conversation history across tools                        | Low      |
| 12   | OpenCode config & end-to-end testing                     | High     |

### Phase 2 — Side-by-side with AI Brain MCP

| Step | Task                                                     | Priority |
| ---- | -------------------------------------------------------- | -------- |
| 13   | Combined `opencode.json` (AI Factory + AI Brain)         | High     |
| 14   | Test combined workflows (brain context → ai_chat)        | High     |
| 15   | Document combined usage patterns                         | Medium   |

### Phase 3 — Deep Integration (AI Factory reads AI Brain)

| Step | Task                                                     | Priority |
| ---- | -------------------------------------------------------- | -------- |
| 16   | Brain loader module (`src/brain/loader.ts`)              | Medium   |
| 17   | Auto-inject persona + rules into `ai_chat`               | Medium   |
| 18   | `ai_brain_chat` tool                                     | Low      |
| 19   | Knowledge search integration                             | Low      |
| 20   | End-to-end testing with brain context                    | Medium   |

### Phase 4 — Optional Enhancements

| Step | Task                                                     | Priority |
| ---- | -------------------------------------------------------- | -------- |
| 21   | Streamable HTTP transport                                | Low      |
| 22   | npm packaging & publish                                  | Low      |

---

## 12. Risks & Considerations

| Risk                                | Mitigation                                                        |
| ----------------------------------- | ----------------------------------------------------------------- |
| Copilot API is unofficial           | Abstract behind interface; swap to official SDK when available     |
| API keys in config file             | Use env vars; `.gitignore` excludes `.env`                        |
| Rate limits on provider APIs        | Add retry logic with exponential backoff                          |
| Provider hangs / slow response      | `withTimeout()` wrapper kills requests after configurable deadline |
| Large responses consume tokens      | `max_tokens` param caps output; truncate if needed                |
| Context window pressure in OpenCode | Keep tool descriptions concise; OpenCode warns about this         |
| SSE transport issues in OpenCode    | Use stdio (local) transport; Streamable HTTP as future option     |
| In-memory conversation history lost | Acceptable for local stdio; document this limitation              |
| stdout pollution breaks MCP         | All logging goes to stderr via `logger.ts`                        |

---

## 13. Future: Deep Integration with AI Brain MCP

Phase 2 goes beyond side-by-side — AI Factory **reads AI Brain files directly** to enrich every prompt sent to Gemini, OpenAI, or Copilot. This turns AI Factory into a brain-aware multi-model gateway.

### 13.1 Architecture

```
OpenCode (MCP Client)
    |
    +--- AI Brain MCP (Python, stdio) ← memory, knowledge, rules, skills, personas
    |
    +--- AI Factory MCP (Node.js, stdio)
              |
              +--- reads ai-brain/ files directly (via AI_BRAIN_PATH env)
              |
              +--- Gemini API (with persona + rules injected as system prompt)
              +--- OpenAI API  (with persona + rules injected as system prompt)
              +--- Copilot API (with persona + rules injected as system prompt)
```

### 13.2 New Environment Variable

```bash
# Path to the ai-brain content directory
AI_BRAIN_PATH=/path/to/code-master-ai-brain-mcp/ai-brain/ai-brain
```

### 13.3 Brain Loader Module (`src/brain/loader.ts`)

Reads Markdown files from the AI Brain directory structure:

```typescript
import { readFile, readdir } from "fs/promises";
import { join } from "path";

const BRAIN_PATH = process.env.AI_BRAIN_PATH;

export async function loadPersona(name: string = "default"): Promise<string | null> {
  if (!BRAIN_PATH) return null;
  try {
    return await readFile(join(BRAIN_PATH, "personas", `${name}.md`), "utf-8");
  } catch {
    return null;
  }
}

export async function loadCoreRules(): Promise<string | null> {
  if (!BRAIN_PATH) return null;
  try {
    return await readFile(join(BRAIN_PATH, "rules", "core.md"), "utf-8");
  } catch {
    return null;
  }
}

export async function searchKnowledge(query: string): Promise<string[]> {
  if (!BRAIN_PATH) return [];
  const knowledgePath = join(BRAIN_PATH, "knowledge");
  const results: string[] = [];
  // Recursively search Markdown files for the query
  // Return matching file contents as context
  return results;
}

export function isBrainAvailable(): boolean {
  return !!BRAIN_PATH;
}
```

### 13.4 Enhanced `ai_chat` with Brain Context

When `AI_BRAIN_PATH` is set, the tool auto-injects the active persona and applicable rules into every request:

```typescript
server.tool(
  "ai_chat",
  // ...
  async ({ provider, prompt, model, system_prompt, temperature, max_tokens }) => {
    const p = getProvider(provider);

    // Build system prompt: user-provided > persona + rules > empty
    let finalSystemPrompt = system_prompt || "";
    if (!system_prompt && isBrainAvailable()) {
      const persona = await loadPersona();
      const rules = await loadCoreRules();
      if (persona || rules) {
        finalSystemPrompt = [persona, rules].filter(Boolean).join("\n\n---\n\n");
      }
    }

    const result = await p.chat(prompt, {
      model,
      systemPrompt: finalSystemPrompt,
      temperature,
      maxTokens: max_tokens,
    });
    return { content: [{ type: "text", text: result }] };
  }
);
```

If `system_prompt` is explicitly provided by the caller, it takes precedence. Brain context is only auto-injected when no system prompt is given.

### 13.5 New Tool: `ai_brain_chat` (Brain-Aware Chat)

A dedicated tool that always loads brain context and allows selecting which brain modules to include:

| Parameter       | Type     | Required | Description                                       |
| --------------- | -------- | -------- | ------------------------------------------------- |
| `provider`      | enum     | Yes      | `"gemini"`, `"copilot"`, or `"openai"`            |
| `prompt`        | string   | Yes      | The prompt to send                                |
| `brain_modules` | string[] | No       | Which brain modules to load: `["persona", "rules", "knowledge"]` |
| `persona`       | string   | No       | Persona name (default: `"default"`)               |
| `model`         | string   | No       | Override default model                            |

This gives fine-grained control over how much brain context is injected per request.

### 13.6 Updated Project Structure

```
ai-factory/
  src/
    brain/
      loader.ts              # Read AI Brain Markdown files
    providers/
      ...
    tools/
      brain-chat.ts          # ai_brain_chat tool (brain-aware)
      ...
```

### 13.7 Implementation Order for Deep Integration

| Phase | Task                                          | Depends On     |
| ----- | --------------------------------------------- | -------------- |
| D1    | Brain loader module (`loader.ts`)             | AI Brain repo  |
| D2    | Auto-inject persona + rules into `ai_chat`    | D1             |
| D3    | `ai_brain_chat` tool                          | D1             |
| D4    | Knowledge search integration                  | D1             |
| D5    | Test with OpenCode end-to-end                 | D2, D3         |

This phase is **optional** — the side-by-side approach (Section 9.2) works without any code changes. Deep integration provides convenience by automating what the user would otherwise do manually (load persona, then pass it to ai_chat).

---

## 14. Future: Streamable HTTP Transport

The default transport is **stdio** (local process). For remote or shared deployments, the MCP SDK supports **Streamable HTTP** (the recommended replacement for SSE):

```typescript
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport("/mcp", res);
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(3000);
```

OpenCode remote config would then be:

```json
{
  "mcp": {
    "ai-factory": {
      "type": "remote",
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer your-secret"
      }
    }
  }
}
```

This is a **low-priority enhancement** — stdio covers the primary use case of a local MCP server running alongside OpenCode.

---

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [OpenCode MCP Servers Docs](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Configuration](https://opencode.ai/docs/config/)
- [Google Gemini API](https://ai.google.dev/api)
- [Gemini OpenAI-Compatible Endpoint](https://ai.google.dev/gemini-api/docs/openai)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [copilot-api (Reverse-Engineered Copilot Proxy)](https://github.com/ericc-ch/copilot-api)
- [GitHub Copilot SDK (Technical Preview)](https://github.blog/changelog/2026-01-14-copilot-sdk-in-technical-preview/)
- [OpenAI Build MCP Server Guide](https://developers.openai.com/apps-sdk/build/mcp-server/)
- [AI Brain MCP Server](https://github.com/alfirus/code-master-ai-brain-mcp) — Companion MCP for memory, knowledge, rules, skills, and personas

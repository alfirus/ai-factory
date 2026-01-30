# AI Factory - Implementation Tasks

Checklist derived from [plan.md](plan.md). Each task maps to a specific plan section.

---

## Phase 1 — Core (AI Factory Standalone)

### 1.1 Project Scaffolding `[plan: §2, §8, §10]`

- [ ] Run `npm init -y`
- [ ] Set `"type": "module"` in `package.json`
- [ ] Install runtime deps: `@modelcontextprotocol/sdk`, `zod`, `@google/genai`, `@anthropic-ai/sdk`, `openai`, `dotenv`
- [ ] Install dev deps: `typescript`, `@types/node`, `tsup`, `tsx`
- [ ] Create `tsconfig.json` (ES2022, ESNext, bundler resolution, strict)
- [ ] Add scripts to `package.json`: `build`, `dev`, `start`
- [ ] Add `"bin"` entry pointing to `./dist/index.js`
- [ ] Create `.gitignore` (node_modules, dist, .env, *.tsbuildinfo)
- [ ] Create `.env.example` with all env vars (GEMINI_API_KEY, ANTHROPIC_API_KEY, COPILOT_API_PORT, COPILOT_DEFAULT_MODEL, GEMINI_DEFAULT_MODEL, ANTHROPIC_DEFAULT_MODEL, LOG_LEVEL, REQUEST_TIMEOUT_MS)
- [ ] Create `src/` directory structure matching plan §2
- [ ] Verify project builds with `npm run build` (empty entry point)

### 1.2 Utilities `[plan: §5.5, §5.6]`

- [ ] Implement `src/utils/logger.ts` — structured stderr logging with LOG_LEVEL support
- [ ] Implement `src/utils/timeout.ts` — `withTimeout()` wrapper using `Promise.race`
- [ ] Implement `src/utils/config.ts` — load and validate env vars via `dotenv`
- [ ] Implement `src/utils/errors.ts` — standardized error class for provider failures

### 1.3 Provider Interface & Registry `[plan: §5.3, §5.4]`

- [ ] Implement `src/providers/base.ts`:
  - [ ] Define `ChatOptions` interface (model, systemPrompt, maxTokens, temperature)
  - [ ] Define `ChatMessage` type (role: system/user/assistant, content)
  - [ ] Define `AIProvider` interface (name, defaultModel, isAvailable, chat)
  - [ ] Implement provider registry: `registerProvider()`, `getProvider()`, `getAllProviders()`
- [ ] Create `src/providers/index.ts` — `registerAllProviders()` stub (providers added later)

### 1.4 Gemini Provider `[plan: §3.1]`

- [ ] Implement `src/providers/gemini.ts`:
  - [ ] Import `@google/genai` SDK
  - [ ] Read `GEMINI_API_KEY` and `GEMINI_DEFAULT_MODEL` from env
  - [ ] `isAvailable()` — check if `GEMINI_API_KEY` is set
  - [ ] `chat()` — accept `string | ChatMessage[]`, call `ai.models.generateContent()`
  - [ ] Support `temperature` and `maxTokens` options
  - [ ] Wrap API call with `withTimeout()`
- [ ] Register in `src/providers/index.ts`
- [ ] Test: verify Gemini responds with a valid API key

### 1.5 Claude Provider `[plan: §3.3]`

- [ ] Implement `src/providers/claude.ts`:
  - [ ] Import `@anthropic-ai/sdk`
  - [ ] Read `ANTHROPIC_API_KEY` and `ANTHROPIC_DEFAULT_MODEL` from env
  - [ ] `isAvailable()` — check if `ANTHROPIC_API_KEY` is set
  - [ ] `chat()` — accept `string | ChatMessage[]`, call `anthropic.messages.create()`
  - [ ] Map `ChatMessage[]` to Anthropic message format
  - [ ] Support `temperature` and `maxTokens` options
  - [ ] Wrap API call with `withTimeout()`
- [ ] Register in `src/providers/index.ts`
- [ ] Test: verify Claude responds with a valid API key

### 1.6 MCP Server + `ai_chat` + `ai_list` Tools `[plan: §4.1, §4.4, §5.1, §5.2]`

- [ ] Implement `src/index.ts` — entry point with shebang, calls `startServer()`
- [ ] Implement `src/server.ts`:
  - [ ] Import `McpServer`, `StdioServerTransport`, `zod`
  - [ ] Call `registerAllProviders()` at startup
  - [ ] Register `ai_chat` tool:
    - [ ] Zod schema: provider (enum), prompt, model, system_prompt, conversation_id, temperature, max_tokens
    - [ ] Handler: get provider, build history, call `chat()`, return result with conversation_id in meta
  - [ ] Register `ai_list` tool:
    - [ ] No parameters
    - [ ] Handler: iterate `getAllProviders()`, return status table
  - [ ] Connect via `StdioServerTransport`
- [ ] Implement conversation store in `src/server.ts`:
  - [ ] `getConversation(id, provider)` — retrieve from Map
  - [ ] `setConversation(id, provider, history)` — store in Map
- [ ] Test with MCP Inspector: `npx @modelcontextprotocol/inspector node dist/index.js`

### 1.7 Copilot Provider `[plan: §3.2]`

- [ ] Implement `src/providers/copilot.ts`:
  - [ ] Import `openai` SDK
  - [ ] Configure with `baseURL: http://localhost:${COPILOT_API_PORT || 4141}`
  - [ ] `isAvailable()` — check if copilot-api proxy is reachable (ping or env check)
  - [ ] `chat()` — accept `string | ChatMessage[]`, call `copilot.chat.completions.create()`
  - [ ] Support `temperature` and `maxTokens` options
  - [ ] Wrap API call with `withTimeout()`
- [ ] Register in `src/providers/index.ts`
- [ ] Test: start `npx copilot-api`, verify provider responds

### 1.8 `ai_compare` Tool `[plan: §4.2]`

- [ ] Implement `ai_compare` in `src/server.ts`:
  - [ ] Zod schema: prompt, providers (optional array), system_prompt, temperature, max_tokens
  - [ ] Handler: call all target providers in parallel with `Promise.allSettled()`
  - [ ] Format output: `## provider\n\nresponse` separated by `---`
  - [ ] Stateless — no conversation history (one-shot by design)
- [ ] Test: compare responses from 2+ configured providers

### 1.9 `ai_review` Tool + Prompt Builder `[plan: §4.3, §4.5]`

- [ ] Implement `src/tools/prompts.ts`:
  - [ ] `buildReviewPrompt(code, language?, focus?)` — build review prompt with focus instructions
  - [ ] Focus options: bugs, security, perf, style, all
- [ ] Implement `ai_review` in `src/server.ts`:
  - [ ] Zod schema: provider, code, language, focus, temperature, max_tokens
  - [ ] Handler: build prompt via `buildReviewPrompt()`, call provider with reviewer system prompt
  - [ ] Stateless — no conversation history (each review stands alone)
- [ ] Test: review a code snippet through each provider

### 1.10 MCP Resource `[plan: §6]`

- [ ] Register `providers://status` resource in `src/server.ts`:
  - [ ] Return JSON array of `{ name, configured, defaultModel }` for each provider
  - [ ] Set mimeType to `application/json`
- [ ] Test: verify resource is visible in MCP Inspector

### 1.11 Conversation History (`ai_chat` only) `[plan: §7]`

- [ ] Verify conversation_id works in `ai_chat`: send prompt, get ID, follow up with same ID
- [ ] Verify multi-turn context: second message references first message's content correctly
- [ ] Verify `ai_compare` and `ai_review` are stateless (no conversation_id param)

### 1.12 OpenCode Config & End-to-End Testing `[plan: §9.1]`

- [ ] Create sample `opencode.json` with AI Factory config (local, stdio)
- [ ] Test in OpenCode: `ai_list` returns provider status
- [ ] Test in OpenCode: `ai_chat` with Gemini
- [ ] Test in OpenCode: `ai_chat` with Claude
- [ ] Test in OpenCode: `ai_chat` with Copilot (if proxy running)
- [ ] Test in OpenCode: `ai_compare` with 2+ providers
- [ ] Test in OpenCode: `ai_review` on a real file
- [ ] Verify no stdout pollution (all logs go to stderr)

---

## Phase 2 — Side-by-Side with AI Brain MCP

### 2.1 Combined OpenCode Configuration `[plan: §9.2]`

- [ ] Create combined `opencode.json` with both `ai-factory` and `ai-brain` MCP entries
- [ ] Verify both servers start and connect in OpenCode
- [ ] Verify `ai_list` shows AI Factory providers
- [ ] Verify `brain_list_personas` (from AI Brain) is accessible

### 2.2 Combined Workflow Testing `[plan: §9.2]`

- [ ] Test: load persona via `brain_load_persona`, pass as `system_prompt` to `ai_chat`
- [ ] Test: search knowledge via `brain_search_knowledge`, feed results to `ai_compare`
- [ ] Test: `ai_review` a file, then `brain_save_memory` to persist the feedback
- [ ] Test: load rules via `brain_get_applicable_rules`, pass to `ai_chat` as system_prompt
- [ ] Verify context budget stays within OpenCode limits with both servers active

### 2.3 Documentation `[plan: §9.2, §9.3]`

- [ ] Update `README.md` with combined setup instructions
- [ ] Document combined workflow examples
- [ ] Document context budget considerations

---

## Phase 3 — Deep Integration (AI Factory reads AI Brain)

### 3.1 Brain Loader Module `[plan: §13.3]`

- [ ] Create `src/brain/` directory
- [ ] Implement `src/brain/loader.ts`:
  - [ ] Read `AI_BRAIN_PATH` from env
  - [ ] `isBrainAvailable()` — check if path is set and directory exists
  - [ ] `loadPersona(name?)` — read `personas/{name}.md`, default `"default"`
  - [ ] `loadCoreRules()` — read `rules/core.md`
  - [ ] `searchKnowledge(query)` — recursively search `knowledge/` Markdown files
- [ ] Add `AI_BRAIN_PATH` to `.env.example`

### 3.2 Auto-Inject Brain Context into `ai_chat` `[plan: §13.4]`

- [ ] Modify `ai_chat` handler:
  - [ ] If no `system_prompt` provided AND `isBrainAvailable()`:
    - [ ] Load default persona
    - [ ] Load core rules
    - [ ] Combine as system prompt
  - [ ] If `system_prompt` is provided, use it as-is (no injection)
- [ ] Test: verify auto-injection works with brain path set
- [ ] Test: verify explicit `system_prompt` overrides brain context

### 3.3 `ai_brain_chat` Tool `[plan: §13.5]`

- [ ] Implement `src/tools/brain-chat.ts`:
  - [ ] Zod schema: provider, prompt, brain_modules (optional array), persona (optional), model (optional)
  - [ ] Handler: selectively load persona, rules, knowledge based on `brain_modules`
  - [ ] Combine loaded content as system prompt
  - [ ] Call provider
- [ ] Register tool in `src/server.ts`
- [ ] Test: call with different `brain_modules` combinations

### 3.4 Knowledge Search Integration `[plan: §13.3]`

- [ ] Implement full recursive Markdown search in `searchKnowledge()`
- [ ] Support: case-insensitive matching across file contents
- [ ] Return: matching file paths and content previews
- [ ] Test: search with various queries against populated knowledge directory

### 3.5 End-to-End Testing with Brain Context `[plan: §13.7]`

- [ ] Test in OpenCode: `ai_chat` auto-injects persona when AI_BRAIN_PATH is set
- [ ] Test in OpenCode: `ai_brain_chat` with persona + rules modules
- [ ] Test in OpenCode: `ai_brain_chat` with knowledge search
- [ ] Test: brain unavailable gracefully (AI_BRAIN_PATH unset or invalid)
- [ ] Verify no performance degradation from file reads

---

## Phase 4 — Optional Enhancements

### 4.1 Streamable HTTP Transport `[plan: §14]`

- [ ] Install `express` dependency
- [ ] Implement HTTP transport option in `src/index.ts` (flag or env var to choose transport)
- [ ] Add `StreamableHTTPServerTransport` setup
- [ ] Add auth middleware (Bearer token from env)
- [ ] Test with OpenCode remote config (`"type": "remote"`)
- [ ] Update README with remote deployment instructions

### 4.2 npm Packaging & Publishing

- [ ] Finalize `package.json` metadata (name, description, keywords, license, repository)
- [ ] Add `"files"` field to include only `dist/` and `README.md`
- [ ] Verify `npx @ebase/ai-factory` works after publish
- [ ] Update OpenCode config docs with npx command
- [ ] Publish to npm

---

## Summary

| Phase | Tasks | Status |
| ----- | ----- | ------ |
| 1 — Core                | 12 groups, ~60 tasks | Not started |
| 2 — Side-by-side        | 3 groups, ~12 tasks  | Not started |
| 3 — Deep integration    | 5 groups, ~17 tasks  | Not started |
| 4 — Optional            | 2 groups, ~11 tasks  | Not started |
| **Total**               | **~100 tasks**       |             |

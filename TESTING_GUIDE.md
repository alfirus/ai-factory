# Integration Testing Guide

**Status:** MCP Inspector running at http://localhost:6274  
**Date:** January 30, 2026

---

## 🎯 5 Integration Tests to Complete

### Prerequisites Setup

1. **Get API Keys** (Required for Tests 2-5)
   ```bash
   # Edit .env file with your API keys:
   GEMINI_API_KEY=your_gemini_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

   **Where to get keys:**
   - Gemini: https://aistudio.google.com/apikey
   - Anthropic: https://console.anthropic.com/

2. **Restart Server** (after adding keys)
   ```bash
   # Stop current server (Ctrl+C in terminal)
   npm start
   # Or with inspector:
   npx @modelcontextprotocol/inspector node dist/index.js
   ```

---

## Test 1: ai_list (No API keys needed) ✅

**Tool:** `ai_list`  
**Purpose:** Display all configured providers and their status

### Test in MCP Inspector

1. In the Inspector UI, find the **Tools** section
2. Click on `ai_list` tool
3. Click **Execute** (no parameters needed)

### Expected Output

```markdown
# Available AI Providers

| Provider | Configured | Default Model |
|----------|-----------|---------------|
| gemini   | ❌        | gemini-2.0-flash-exp |
| claude   | ❌        | claude-3-5-sonnet-20241022 |
| copilot  | ❌        | gpt-4o |

⚠️ Configure providers by setting environment variables...
```

### Pass Criteria
- ✅ Returns markdown table
- ✅ Shows 3 providers (gemini, claude, copilot)
- ✅ Shows configuration status
- ✅ Shows default models

---

## Test 2: ai_chat with Gemini ⏳

**Tool:** `ai_chat`  
**Provider:** `gemini`  
**Requirements:** `GEMINI_API_KEY` in .env

### Test in MCP Inspector

1. Select `ai_chat` tool
2. Fill in parameters:
   ```json
   {
     "provider": "gemini",
     "prompt": "Say hello and tell me what you are in one sentence."
   }
   ```
3. Click **Execute**

### Expected Output
Response from Gemini model (something like "Hello! I'm Gemini, Google's large language model...")

### Pass Criteria
- ✅ Returns text response from Gemini
- ✅ No timeout errors
- ✅ Response is relevant to prompt

---

## Test 3: ai_chat with Claude ⏳

**Tool:** `ai_chat`  
**Provider:** `claude`  
**Requirements:** `ANTHROPIC_API_KEY` in .env

### Test in MCP Inspector

1. Select `ai_chat` tool
2. Fill in parameters:
   ```json
   {
     "provider": "claude",
     "prompt": "Say hello and tell me what you are in one sentence."
   }
   ```
3. Click **Execute**

### Expected Output
Response from Claude model (something like "Hello! I'm Claude, an AI assistant created by Anthropic...")

### Pass Criteria
- ✅ Returns text response from Claude
- ✅ No timeout errors
- ✅ Response is relevant to prompt

---

## Test 4: ai_chat with Copilot ⏳

**Tool:** `ai_chat`  
**Provider:** `copilot`  
**Requirements:** GitHub Copilot proxy running on port 4141

### Setup Copilot Proxy (Optional)

This test requires the GitHub Copilot reverse-engineered proxy. If you don't have it:
- Skip this test (Copilot is optional)
- Or install from: https://github.com/aaamoon/copilot-gpt4-service

### Test in MCP Inspector

1. Ensure proxy is running on http://localhost:4141
2. Select `ai_chat` tool
3. Fill in parameters:
   ```json
   {
     "provider": "copilot",
     "prompt": "Say hello and tell me what you are in one sentence."
   }
   ```
4. Click **Execute**

### Expected Output
Response from Copilot/GPT-4 model

### Pass Criteria
- ✅ Returns text response from Copilot
- ✅ No connection errors
- ✅ Response is relevant to prompt

**Note:** This test is optional. If you don't have the Copilot proxy, mark as "Skipped - Copilot proxy not available"

---

## Test 5: ai_compare with Multiple Providers ⏳

**Tool:** `ai_compare`  
**Providers:** `gemini`, `claude`  
**Requirements:** Both `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` in .env

### Test in MCP Inspector

1. Select `ai_compare` tool
2. Fill in parameters:
   ```json
   {
     "prompt": "What is the capital of France?",
     "providers": ["gemini", "claude"]
   }
   ```
3. Click **Execute**

### Expected Output

```markdown
## Response from gemini (gemini-2.0-flash-exp)

The capital of France is Paris.

---

## Response from claude (claude-3-5-sonnet-20241022)

The capital of France is Paris.
```

### Pass Criteria
- ✅ Returns responses from both providers
- ✅ Responses are formatted with headers
- ✅ Responses are separated by `---`
- ✅ Both responses answer the question correctly
- ✅ Shows model names in headers

---

## Additional Test: Multi-turn Conversation

**Tool:** `ai_chat`  
**Feature:** Conversation history with `conversation_id`

### Test Steps

1. **First Message:**
   ```json
   {
     "provider": "gemini",
     "prompt": "My name is Alice.",
     "conversation_id": "test-conv-123"
   }
   ```
   Expected: Gemini acknowledges your name

2. **Second Message:**
   ```json
   {
     "provider": "gemini",
     "prompt": "What's my name?",
     "conversation_id": "test-conv-123"
   }
   ```
   Expected: Gemini responds "Alice" or similar

### Pass Criteria
- ✅ Second response references information from first message
- ✅ Provider remembers context using `conversation_id`

---

## Checklist Summary

- [ ] **Test 1:** ai_list shows all providers ✅ (No API keys needed)
- [ ] **Test 2:** ai_chat with Gemini works ⏳ (Needs GEMINI_API_KEY)
- [ ] **Test 3:** ai_chat with Claude works ⏳ (Needs ANTHROPIC_API_KEY)
- [ ] **Test 4:** ai_chat with Copilot works ⏳ (Needs proxy - optional)
- [ ] **Test 5:** ai_compare with multiple providers ⏳ (Needs both API keys)
- [ ] **Bonus:** Multi-turn conversation works ⏳ (Needs any API key)

---

## Troubleshooting

### "Provider not available" error
**Solution:** Check that API keys are set in `.env` and restart the server

### "Request timeout" error
**Solution:** Check your internet connection or increase `REQUEST_TIMEOUT_MS` in `.env`

### "Invalid API key" error
**Solution:** Verify your API keys are correct and active

### Inspector not loading
**Solution:** Check that port 6274 is not in use, or restart the inspector

---

## After Testing

Once all tests pass, update [docs/tasks.md](docs/tasks.md):

```markdown
### 1.12 Integration & Validation Testing

- [x] Test ai_list in MCP Inspector — confirmed provider status display
- [x] Test ai_chat with Gemini — confirmed API integration works
- [x] Test ai_chat with Claude — confirmed API integration works
- [x] Test ai_chat with Copilot — confirmed proxy integration works (or skipped)
- [x] Test ai_compare with multiple providers — confirmed parallel requests work
- [x] Test conversation history with conversation_id — confirmed multi-turn works
- [x] Verify no stdout pollution — confirmed logs go to stderr only
```

Then update summary to **100/100 tasks complete (100%)** 🎉

---

## Quick Reference: MCP Inspector URL

```
http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=f42c51c25fb055d11d4f256d9e6429f6b082d8486b1374d611b082c7f590e696
```

**Session Token:** `f42c51c25fb055d11d4f256d9e6429f6b082d8486b1374d611b082c7f590e696`

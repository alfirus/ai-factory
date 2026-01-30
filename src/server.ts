import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Tool, TextContent, ResourceContents } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger } from "./utils/logger.js";
import { registerAllProviders, getProvider, getAllProviders, ChatMessage } from "./providers/index.js";
import { buildReviewPrompt } from "./tools/prompts.js";
import { isBrainAvailable, loadPersona, loadCoreRules } from "./brain/loader.js";
import { buildBrainSystemPrompt } from "./tools/brain-chat.js";
import { usageTracker } from './utils/usage-tracker.js';

// Conversation storage
const conversations = new Map<string, Map<string, ChatMessage[]>>();

function getConversation(id: string, provider: string): ChatMessage[] {
  if (!conversations.has(id)) {
    conversations.set(id, new Map());
  }
  const providerConvos = conversations.get(id)!;
  return providerConvos.get(provider) || [];
}

function setConversation(id: string, provider: string, history: ChatMessage[]): void {
  if (!conversations.has(id)) {
    conversations.set(id, new Map());
  }
  conversations.get(id)!.set(provider, history);
}

// Initialize server
const server = new Server({
  name: "ai-factory",
  version: "1.0.0",
});

// Register tools
const aiChatSchema = z.object({
	provider: z.string().describe('Provider name: gemini, openai, or copilot'),
	prompt: z.string().describe('The user prompt to send to the provider'),
	model: z.string().optional().describe('Optional model override'),
	system_prompt: z.string().optional().describe('Optional system prompt'),
	conversation_id: z.string().optional().describe('Conversation ID for multi-turn chat'),
	temperature: z.number().optional().describe('Temperature for creativity (0-1)'),
	max_tokens: z.number().optional().describe('Maximum tokens in response'),
});

const aiCompareSchema = z.object({
  prompt: z.string().describe("The prompt to send to all providers"),
  providers: z.array(z.string()).optional().describe("Provider names to compare (defaults to all available)"),
  system_prompt: z.string().optional().describe("Optional system prompt"),
  temperature: z.number().optional().describe("Temperature for creativity (0-1)"),
  max_tokens: z.number().optional().describe("Maximum tokens in response"),
});

const aiReviewSchema = z.object({
  provider: z.string().describe("Provider name for code review"),
  code: z.string().describe("Code snippet to review"),
  language: z.string().optional().describe("Programming language"),
  focus: z.enum(["bugs", "security", "perf", "style", "all"]).optional().describe("Review focus area"),
  temperature: z.number().optional().describe("Temperature for creativity (0-1)"),
  max_tokens: z.number().optional().describe("Maximum tokens in response"),
});

const aiBrainChatSchema = z.object({
	provider: z.string().describe('Provider name: gemini, openai, or copilot'),
	prompt: z.string().describe('The user prompt to send to the provider'),
	model: z.string().optional().describe('Optional model override'),
	persona: z.string().optional().describe("Persona name to load (defaults to 'default')"),
	brain_modules: z
		.array(z.enum(['persona', 'rules', 'knowledge']))
		.optional()
		.describe('Brain modules to include: persona, rules, knowledge'),
	knowledge_query: z.string().optional().describe('Query for knowledge search'),
	temperature: z.number().optional().describe('Temperature for creativity (0-1)'),
	max_tokens: z.number().optional().describe('Maximum tokens in response'),
});

const aiListSchema = z.object({});

server.setRequestHandler(async (request) => {
  if (request.method === "tools/list") {
    const tools: Tool[] = [
      {
        name: "ai_chat",
        description: "Send a prompt to a specific AI provider with optional conversation history",
        inputSchema: aiChatSchema,
      },
      {
        name: "ai_compare",
        description: "Send a prompt to multiple providers and compare responses",
        inputSchema: aiCompareSchema,
      },
      {
        name: "ai_review",
        description: "Review code using a selected AI provider",
        inputSchema: aiReviewSchema,
      },
      {
        name: "ai_list",
        description: "List configured AI providers and their status",
        inputSchema: aiListSchema,
      },
    ];
    
    // Add ai_brain_chat if brain is available
    if (isBrainAvailable()) {
      tools.push({
        name: "ai_brain_chat",
        description: "Send a prompt to a provider with AI Brain context (persona, rules, knowledge)",
        inputSchema: aiBrainChatSchema,
      });
    }
    
    return { tools };
  }

  if (request.method === "tools/call") {
    const { name, arguments: args } = request.params;

    try {
      if (name === "ai_chat") {
        const parsed = aiChatSchema.parse(args);
        const provider = getProvider(parsed.provider);

        if (!provider) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" not found`,
              },
            ],
            isError: true,
          };
        }

        if (!provider.isAvailable()) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" is not configured`,
              },
            ],
            isError: true,
          };
        }

        const conversationId = parsed.conversation_id || `conv-${Date.now()}`;
        let history = getConversation(conversationId, parsed.provider);

        // Add user message to history
        history.push({
          role: "user",
          content: parsed.prompt,
        });

        // Determine system prompt: explicit override, or auto-inject brain if available
        let systemPrompt = parsed.system_prompt;
        if (!systemPrompt && isBrainAvailable()) {
          const persona = loadPersona("default");
          const rules = loadCoreRules();
          if (persona || rules) {
            const parts = [];
            if (persona) parts.push("## Persona\n" + persona);
            if (rules) parts.push("## Rules\n" + rules);
            systemPrompt = parts.join("\n\n---\n\n");
            logger.debug("Auto-injected brain context into ai_chat");
          }
        }

        // Call provider
        const chatModel = parsed.model || provider.defaultModel;
								const response = await usageTracker.track(parsed.provider, chatModel, 'ai_chat', () =>
									provider.chat(history, {
										model: parsed.model,
										systemPrompt,
										temperature: parsed.temperature,
										maxTokens: parsed.max_tokens,
									}),
								);

        // Add assistant response to history
        history.push({
          role: "assistant",
          content: response,
        });

        // Save conversation
        setConversation(conversationId, parsed.provider, history);

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
          meta: {
            conversation_id: conversationId,
            provider: parsed.provider,
            model: parsed.model || provider.defaultModel,
          },
        };
      }

      if (name === "ai_compare") {
        const parsed = aiCompareSchema.parse(args);
        const targetProviders = parsed.providers
          ? parsed.providers.map((name) => getProvider(name)).filter((p) => p !== undefined)
          : getAllProviders().filter((p) => p.isAvailable());

        if (targetProviders.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No available providers found",
              },
            ],
            isError: true,
          };
        }

        const results = await Promise.allSettled(
          targetProviders.map(async (provider) => {
            const response = await usageTracker.track(provider.name, provider.defaultModel, 'ai_compare', () =>
													provider.chat(parsed.prompt, {
														systemPrompt: parsed.system_prompt,
														temperature: parsed.temperature,
														maxTokens: parsed.max_tokens,
													}),
												);
            return { provider: provider.name, response };
          })
        );

        const comparisons = results
          .map((result) => {
            if (result.status === "fulfilled") {
              return `## ${result.value.provider}\n\n${result.value.response}`;
            } else {
              return `## ${(result.reason as any)?.provider || "unknown"}\n\n**Error:** ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
            }
          })
          .join("\n\n---\n\n");

        return {
          content: [
            {
              type: "text",
              text: comparisons,
            },
          ],
        };
      }

      if (name === "ai_review") {
        const parsed = aiReviewSchema.parse(args);
        const provider = getProvider(parsed.provider);

        if (!provider) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" not found`,
              },
            ],
            isError: true,
          };
        }

        if (!provider.isAvailable()) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" is not configured`,
              },
            ],
            isError: true,
          };
        }

        const reviewPrompt = buildReviewPrompt(parsed.code, parsed.language, parsed.focus as any);
        const response = await usageTracker.track(parsed.provider, provider.defaultModel, 'ai_review', () =>
									provider.chat(reviewPrompt, {
										model: undefined,
										temperature: parsed.temperature,
										maxTokens: parsed.max_tokens,
									}),
								);

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
          meta: {
            provider: parsed.provider,
            focus: parsed.focus || "all",
          },
        };
      }

      if (name === "ai_brain_chat") {
        if (!isBrainAvailable()) {
          return {
            content: [
              {
                type: "text",
                text: "AI Brain is not available. Please set AI_BRAIN_PATH environment variable.",
              },
            ],
            isError: true,
          };
        }

        const parsed = aiBrainChatSchema.parse(args);
        const provider = getProvider(parsed.provider);

        if (!provider) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" not found`,
              },
            ],
            isError: true,
          };
        }

        if (!provider.isAvailable()) {
          return {
            content: [
              {
                type: "text",
                text: `Provider "${parsed.provider}" is not configured`,
              },
            ],
            isError: true,
          };
        }

        // Build brain context
        const brainSystemPrompt = await buildBrainSystemPrompt({
          persona: parsed.persona,
          modules: parsed.brain_modules,
          knowledgeQuery: parsed.knowledge_query,
        });

        // Call provider with brain context
        const brainModel = parsed.model || provider.defaultModel;
								const response = await usageTracker.track(parsed.provider, brainModel, 'ai_brain_chat', () =>
									provider.chat(parsed.prompt, {
										model: parsed.model,
										systemPrompt: brainSystemPrompt,
										temperature: parsed.temperature,
										maxTokens: parsed.max_tokens,
									}),
								);

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
          meta: {
            provider: parsed.provider,
            model: parsed.model || provider.defaultModel,
            brain_modules: parsed.brain_modules || ["persona", "rules"],
          },
        };
      }

      if (name === "ai_list") {
        const providers = getAllProviders().map((p) => ({
          name: p.name,
          configured: p.isAvailable(),
          defaultModel: p.defaultModel,
        }));

        const table = providers
          .map((p) => `| ${p.name} | ${p.configured ? "✓" : "✗"} | ${p.defaultModel} |`)
          .join("\n");

        const output = `| Provider | Configured | Default Model |\n|----------|------------|-----------|\n${table}`;

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      logger.error("Tool call error", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (request.method === "resources/list") {
    return {
      resources: [
        {
          uri: "providers://status",
          name: "AI Provider Status",
          mimeType: "application/json",
          description: "Current status of all configured AI providers",
        },
      ],
    };
  }

  if (request.method === "resources/read") {
    const { uri } = request.params;
    if (uri === "providers://status") {
      const providers = getAllProviders().map((p) => ({
        name: p.name,
        configured: p.isAvailable(),
        defaultModel: p.defaultModel,
      }));

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(providers, null, 2),
          } as ResourceContents,
        ],
      };
    }

    return {
      contents: [],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown request: ${request.method}`,
      },
    ],
    isError: true,
  };
});

export async function startServer(): Promise<void> {
  registerAllProviders();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("AI Factory MCP Server started");
}

export { server };

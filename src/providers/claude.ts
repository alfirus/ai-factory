import Anthropic from "@anthropic-ai/sdk";
import { config } from "../utils/config.js";
import { withTimeout } from "../utils/timeout.js";
import { logger } from "../utils/logger.js";
import { AIFactoryError } from "../utils/errors.js";
import { AIProvider, ChatOptions, ChatMessage } from "./base.js";

class ClaudeProvider implements AIProvider {
  public name = "claude";
  public defaultModel = config.ANTHROPIC_DEFAULT_MODEL;
  private client: Anthropic | null = null;

  isAvailable(): boolean {
    return !!config.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: config.ANTHROPIC_API_KEY,
      });
    }
    return this.client;
  }

  async chat(messages: string | ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.isAvailable()) {
      throw new AIFactoryError("Anthropic API key not configured", "PROVIDER_UNAVAILABLE");
    }

    try {
      const client = this.getClient();
      const model = options.model || this.defaultModel;

      // Convert messages to Anthropic format
      const anthropicMessages: Anthropic.MessageParam[] = [];

      if (typeof messages === "string") {
        anthropicMessages.push({
          role: "user",
          content: messages,
        });
      } else {
        for (const msg of messages) {
          if (msg.role === "system") {
            // System messages are handled separately
            continue;
          }
          anthropicMessages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          });
        }
      }

      const result = await withTimeout(
        client.messages.create({
          model,
          max_tokens: options.maxTokens || 1024,
          temperature: options.temperature,
          system: options.systemPrompt,
          messages: anthropicMessages,
        })
      );

      const textContent = result.content.find((block) => block.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new AIFactoryError("No text content in Claude response", "INVALID_RESPONSE");
      }

      logger.debug(`Claude response received for model ${model}`);
      return textContent.text;
    } catch (error) {
      logger.error("Claude API error", error);
      if (error instanceof AIFactoryError) throw error;
      throw new AIFactoryError(`Claude API error: ${error instanceof Error ? error.message : String(error)}`, "CLAUDE_ERROR");
    }
  }
}

export default new ClaudeProvider();

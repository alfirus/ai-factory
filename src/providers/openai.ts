import OpenAI from "openai";
import { config } from "../utils/config.js";
import { withTimeout } from "../utils/timeout.js";
import { logger } from "../utils/logger.js";
import { AIFactoryError } from "../utils/errors.js";
import { AIProvider, ChatOptions, ChatMessage } from "./base.js";

class OpenAIProvider implements AIProvider {
  public name = "openai";
  public defaultModel = config.OPENAI_DEFAULT_MODEL;
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    return !!config.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
    return this.client;
  }

  async chat(messages: string | ChatMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.isAvailable()) {
      throw new AIFactoryError("OpenAI API key not configured", "PROVIDER_UNAVAILABLE");
    }

    try {
      const client = this.getClient();
      const model = options.model || this.defaultModel;

      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (typeof messages === "string") {
        openaiMessages.push({
          role: "user",
          content: messages,
        });
      } else {
        for (const msg of messages) {
          openaiMessages.push({
            role: msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : "user",
            content: msg.content,
          });
        }
      }

      if (options.systemPrompt && !openaiMessages.some(m => m.role === "system")) {
        openaiMessages.unshift({
          role: "system",
          content: options.systemPrompt,
        });
      }

      const result = await withTimeout(
        client.chat.completions.create({
          model,
          messages: openaiMessages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        })
      );

      const choice = result.choices[0];
      if (!choice.message.content) {
        throw new AIFactoryError("No content in OpenAI response", "INVALID_RESPONSE");
      }

      logger.debug(`OpenAI response received for model ${model}`);
      return choice.message.content;
    } catch (error) {
      logger.error("OpenAI API error", error);
      if (error instanceof AIFactoryError) throw error;
      throw new AIFactoryError(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`, "OPENAI_ERROR");
    }
  }
}

export default new OpenAIProvider();

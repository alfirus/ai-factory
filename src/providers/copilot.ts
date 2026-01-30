import OpenAI from "openai";
import { config } from "../utils/config.js";
import { withTimeout } from "../utils/timeout.js";
import { logger } from "../utils/logger.js";
import { AIFactoryError } from "../utils/errors.js";
import { AIProvider, ChatOptions, ChatMessage } from "./base.js";

class CopilotProvider implements AIProvider {
  public name = "copilot";
  public defaultModel = config.COPILOT_DEFAULT_MODEL;
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    // Check if env indicates copilot should be used (can be overridden)
    // In a real scenario, we'd ping the proxy endpoint
    return true; // Assume available; actual check would ping http://localhost:COPILOT_API_PORT
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        baseURL: `http://localhost:${config.COPILOT_API_PORT}`,
        apiKey: "not-needed", // copilot-api proxy doesn't validate
      });
    }
    return this.client;
  }

  async chat(messages: string | ChatMessage[], options: ChatOptions = {}): Promise<string> {
    try {
      const client = this.getClient();
      const model = options.model || this.defaultModel;

      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.Messages.MessageParam[] = [];

      if (typeof messages === "string") {
        openaiMessages.push({
          role: "user",
          content: messages,
        });
      } else {
        for (const msg of messages) {
          openaiMessages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          });
        }
      }

      if (options.systemPrompt) {
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
        throw new AIFactoryError("No content in Copilot response", "INVALID_RESPONSE");
      }

      logger.debug(`Copilot response received for model ${model}`);
      return choice.message.content;
    } catch (error) {
      logger.error("Copilot API error", error);
      if (error instanceof AIFactoryError) throw error;
      throw new AIFactoryError(`Copilot API error: ${error instanceof Error ? error.message : String(error)}`, "COPILOT_ERROR");
    }
  }
}

export default new CopilotProvider();

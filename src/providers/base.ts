import { z } from "zod";

export interface ChatOptions {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  defaultModel: string;
  isAvailable(): boolean;
  chat(messages: string | ChatMessage[], options?: ChatOptions): Promise<string>;
}

// Provider registry
const providers = new Map<string, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): AIProvider | undefined {
  return providers.get(name);
}

export function getAllProviders(): AIProvider[] {
  return Array.from(providers.values());
}

export function getAvailableProviders(): AIProvider[] {
  return getAllProviders().filter((p) => p.isAvailable());
}

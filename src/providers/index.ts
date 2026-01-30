import { registerProvider } from "./base.js";
import gemini from "./gemini.js";
import openai from './openai.js';
import copilot from "./copilot.js";

export function registerAllProviders(): void {
  registerProvider(gemini);
  registerProvider(openai);
  registerProvider(copilot);
}

export * from "./base.js";

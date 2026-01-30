import { registerProvider } from "./base.js";
import gemini from "./gemini.js";
import claude from "./claude.js";
import copilot from "./copilot.js";

export function registerAllProviders(): void {
  registerProvider(gemini);
  registerProvider(claude);
  registerProvider(copilot);
}

export * from "./base.js";

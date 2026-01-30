import dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config();

export const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_DEFAULT_MODEL: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-pro",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_DEFAULT_MODEL: process.env.ANTHROPIC_DEFAULT_MODEL || "claude-3-5-sonnet-20241022",
  COPILOT_API_PORT: parseInt(process.env.COPILOT_API_PORT || "4141", 10),
  COPILOT_DEFAULT_MODEL: process.env.COPILOT_DEFAULT_MODEL || "gpt-4",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10),
  AI_BRAIN_PATH: process.env.AI_BRAIN_PATH || "",
  HTTP_PORT: parseInt(process.env.HTTP_PORT || "3000", 10),
  AUTH_TOKEN: process.env.AUTH_TOKEN || "",
};

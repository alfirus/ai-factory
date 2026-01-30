#!/usr/bin/env node
import { startServer, server } from "./server.js";
import { startHTTPServer } from "./transports/http.js";
import { registerAllProviders } from "./providers/index.js";
import { logger } from "./utils/logger.js";

async function main() {
  // Check if running in HTTP mode
  const useHTTP = process.env.TRANSPORT === "http";

  if (useHTTP) {
    // Start with HTTP transport
    registerAllProviders();
    await startHTTPServer(server);
    logger.info("AI Factory running in HTTP mode");
  } else {
    // Default: start with stdio transport
    await startServer();
  }
}

main().catch((error) => {
  logger.error("Server error", error);
  process.exit(1);
});

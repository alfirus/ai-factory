import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export async function startHTTPServer(mcpServer: Server): Promise<void> {
  const app = express();
  const port = config.HTTP_PORT;

  // Middleware
  app.use(express.json());

  // Auth middleware (if token is configured)
  if (config.AUTH_TOKEN) {
    app.use((req: Request, res: Response, next) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (token !== config.AUTH_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", server: "ai-factory" });
  });

  // Provider status endpoint
  app.get("/providers", (req: Request, res: Response) => {
    const response = mcpServer.requestHandler({
      method: "resources/read",
      params: {
        uri: "providers://status",
      },
    } as any);

    res.json(response);
  });

  // MCP request handler endpoint
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      const request = req.body;
      const result = await mcpServer.requestHandler(request);
      res.json(result);
    } catch (error) {
      logger.error("MCP request error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`HTTP server listening on port ${port}`);
      logger.info(`Health: http://localhost:${port}/health`);
      logger.info(`Providers: http://localhost:${port}/providers`);
      logger.info(`MCP: POST http://localhost:${port}/mcp`);
      if (config.AUTH_TOKEN) {
        logger.info("Auth enabled: Bearer token required");
      }
      resolve();
    });
  });
}

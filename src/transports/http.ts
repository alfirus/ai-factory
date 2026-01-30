import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { usageTracker } from "../utils/usage-tracker.js";

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

  // Usage quota JSON API
  app.get("/usage", (req: Request, res: Response) => {
    res.json(usageTracker.getSummary());
  });

  // Dashboard UI
  app.get("/", (req: Request, res: Response) => {
    const summary = usageTracker.getSummary();
    const uptimeHours = (summary.uptime / 3600000).toFixed(1);
    const uptimeMin = Math.floor(summary.uptime / 60000);

    const providerRows = summary.providers.length > 0
      ? summary.providers
          .map((p) => {
            const successRate = p.totalRequests > 0
              ? ((p.successCount / p.totalRequests) * 100).toFixed(1)
              : "0.0";
            const lastUsed = p.lastUsed
              ? new Date(p.lastUsed).toLocaleString()
              : "-";
            const modelList = Object.entries(p.models)
              .map(([m, c]) => `<span class="badge">${m} (${c})</span>`)
              .join(" ");
            return `
            <tr>
              <td><strong>${p.provider}</strong></td>
              <td>${p.totalRequests}</td>
              <td class="success">${p.successCount}</td>
              <td class="error">${p.errorCount}</td>
              <td>${successRate}%</td>
              <td>${p.avgDurationMs}ms</td>
              <td>${lastUsed}</td>
              <td>${modelList}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" style="text-align:center;color:#888;">No requests yet</td></tr>`;

    const errorRows = summary.recentErrors.length > 0
      ? summary.recentErrors
          .map((e) => `
            <tr>
              <td>${new Date(e.timestamp).toLocaleString()}</td>
              <td>${e.provider}</td>
              <td>${e.tool}</td>
              <td>${e.model}</td>
              <td class="error">${e.error || "Unknown"}</td>
            </tr>`)
          .join("")
      : `<tr><td colspan="5" style="text-align:center;color:#888;">No errors</td></tr>`;

    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Factory - Usage Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e1e4e8; padding: 24px; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #f0f0f0; }
    h2 { font-size: 1.1rem; margin: 24px 0 12px; color: #c9d1d9; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px 20px; min-width: 160px; }
    .stat-card .label { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-card .value { font-size: 1.8rem; font-weight: 600; margin-top: 4px; }
    .stat-card .value.green { color: #3fb950; }
    .stat-card .value.blue { color: #58a6ff; }
    .stat-card .value.orange { color: #d29922; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
    th { background: #1c2128; text-align: left; padding: 10px 14px; font-size: 0.8rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #30363d; }
    td { padding: 10px 14px; border-bottom: 1px solid #21262d; font-size: 0.9rem; }
    tr:last-child td { border-bottom: none; }
    .success { color: #3fb950; }
    .error { color: #f85149; }
    .badge { display: inline-block; background: #1f2937; border: 1px solid #30363d; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
    .refresh { margin-top: 20px; text-align: center; }
    .refresh a { color: #58a6ff; text-decoration: none; font-size: 0.85rem; }
    .refresh a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>AI Factory - Usage Dashboard</h1>
  <p class="subtitle">Uptime: ${uptimeMin} min (${uptimeHours} hrs) &middot; Auto-refresh: 30s</p>

  <div class="stats">
    <div class="stat-card">
      <div class="label">Total Requests</div>
      <div class="value blue">${summary.totalRequests}</div>
    </div>
    <div class="stat-card">
      <div class="label">Providers Active</div>
      <div class="value green">${summary.providers.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Errors</div>
      <div class="value orange">${summary.recentErrors.length}</div>
    </div>
  </div>

  <h2>Provider Usage</h2>
  <table>
    <thead>
      <tr>
        <th>Provider</th>
        <th>Requests</th>
        <th>Success</th>
        <th>Errors</th>
        <th>Success Rate</th>
        <th>Avg Duration</th>
        <th>Last Used</th>
        <th>Models</th>
      </tr>
    </thead>
    <tbody>${providerRows}</tbody>
  </table>

  <h2>Recent Errors</h2>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Provider</th>
        <th>Tool</th>
        <th>Model</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>${errorRows}</tbody>
  </table>

  <div class="refresh"><a href="/">Refresh</a> &middot; <a href="/usage">JSON API</a></div>
  <script>setTimeout(() => location.reload(), 30000);</script>
</body>
</html>`);
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
      logger.info(`Dashboard: http://localhost:${port}/`);
      logger.info(`Usage API: http://localhost:${port}/usage`);
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

import express from "express";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";

import {
  handleArticleContentRequest,
  handleHealthRequest,
  handleNewsRequest,
  handleWeatherRequest,
} from "./server/api-handlers";
import { startFeedPipeline } from "./server/news-service";

function createApiLimiter(max: number) {
  return rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  skip: (request) => {
    if (process.env.NODE_ENV !== "production") {
      return true;
    }

    const ip = request.ip || request.socket.remoteAddress || "";
    return ip.includes("127.0.0.1") || ip.includes("::1") || ip.includes("localhost");
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Prilis vela poziadaviek. Skuste to neskor." }
  });
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const newsLimiter = createApiLimiter(240);
  const weatherLimiter = createApiLimiter(180);
  const articleLimiter = createApiLimiter(45);
  const healthLimiter = createApiLimiter(120);

  startFeedPipeline();

  app.get("/api/news", newsLimiter, (request, response) => {
    void handleNewsRequest(request, response);
  });

  app.get("/api/article-content", articleLimiter, (request, response) => {
    void handleArticleContentRequest(request, response);
  });

  app.get("/api/weather", weatherLimiter, (request, response) => {
    void handleWeatherRequest(request, response);
  });

  app.get("/api/health", healthLimiter, (request, response) => {
    void handleHealthRequest(request, response);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_request, response) => {
      response.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

void startServer();

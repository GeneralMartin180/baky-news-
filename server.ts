import express from "express";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";

import {
  handleArticleContentRequest,
  handleHealthRequest,
  handleMarketsRequest,
  handleNewsRequest,
  handleWeatherRequest,
} from "./server/api-handlers";
import { startFeedPipeline } from "./server/news-service";
import { getDefaultSecurityHeaders } from "./server/request-security";

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
  const newsLimiter = createApiLimiter(120);
  const weatherLimiter = createApiLimiter(120);
  const marketsLimiter = createApiLimiter(120);
  const articleLimiter = createApiLimiter(24);
  const healthLimiter = createApiLimiter(60);

  app.set("trust proxy", 1);
  app.use("/api", (_request, response, next) => {
    for (const [name, value] of Object.entries(getDefaultSecurityHeaders())) {
      response.setHeader(name, value);
    }
    next();
  });

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

  app.get("/api/markets", marketsLimiter, (request, response) => {
    void handleMarketsRequest(request, response);
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

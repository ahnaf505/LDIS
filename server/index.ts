import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createApp, errorHandler } from "./app";
import { config } from "./config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--production");

async function createServer() {
  const app = createApp();

  if (isProduction) {
    const distDir = path.join(rootDir, "dist");
    const indexHtmlPath = path.join(distDir, "index.html");

    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(indexHtmlPath);
    });

    return app;
  }

  const vite = await createViteServer({
    root: rootDir,
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const templatePath = path.join(rootDir, "index.html");
      const template = await fs.readFile(templatePath, "utf8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
  app.use(errorHandler);

  return app;
}

const app = await createServer();

app.listen(config.port, "0.0.0.0", () => {
  const mode = isProduction ? "production" : "development";
  console.log(`LDIS Lookup Express app running in ${mode} mode at http://localhost:${config.port}`);
});

import express from "express";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}

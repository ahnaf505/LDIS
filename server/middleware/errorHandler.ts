import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Unhandled express exception", error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: message });
};

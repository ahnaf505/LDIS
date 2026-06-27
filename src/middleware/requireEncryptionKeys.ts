import { Request, Response, NextFunction } from "express";

export function requireEncryptionKeys(req: Request, res: Response, next: NextFunction) {
  const key1Hex = typeof req.query.k1 === "string" ? req.query.k1 : "";
  const key2Hex = req.header("X-Key-2") || "";

  if (!key1Hex || !key2Hex || key1Hex.length !== 64 || key2Hex.length !== 64) {
    res.status(403).send("Missing or invalid encryption keys");
    return;
  }

  try {
    res.locals.key1 = Buffer.from(key1Hex, "hex");
    res.locals.key2 = Buffer.from(key2Hex, "hex");
    next();
  } catch (error) {
    res.status(403).send("Invalid encryption keys format");
  }
}

import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { config } from "../config";
import { searchOcrDocuments } from "../services/elasticsearch";

function decryptQuery(encryptedHex: string, key1: Buffer, key2: Buffer): string {
  const finalBuffer = Buffer.from(encryptedHex, "hex");

  // Decrypt Layer 2
  const iv2 = finalBuffer.subarray(0, 16);
  const cipherText2 = finalBuffer.subarray(16);
  const decipher2 = crypto.createDecipheriv("aes-256-cbc", key2, iv2);
  let layer1Buffer = decipher2.update(cipherText2);
  layer1Buffer = Buffer.concat([layer1Buffer, decipher2.final()]);

  // Decrypt Layer 1
  const iv1 = layer1Buffer.subarray(0, 16);
  const cipherText1 = layer1Buffer.subarray(16);
  const decipher1 = crypto.createDecipheriv("aes-256-cbc", key1, iv1);
  let decryptedText = decipher1.update(cipherText1);
  decryptedText = Buffer.concat([decryptedText, decipher1.final()]);

  return decryptedText.toString("utf8");
}

export class SearchController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const encryptedQuery = typeof req.query.q === "string" ? req.query.q : "";
      const { key1, key2 } = res.locals;

      if (!encryptedQuery) {
        res.status(400).send("Query parameter q is required");
        return;
      }

      let query = "";
      try {
        query = decryptQuery(encryptedQuery, key1, key2);
      } catch (err) {
        console.error("Failed to decrypt search query:", err);
        res.status(400).send("Failed to decrypt search query");
        return;
      }

      const requestedSize = typeof req.query.size === "string" ? Number(req.query.size) : 12;
      const size = Number.isFinite(requestedSize) ? Math.min(Math.max(requestedSize, 1), 100) : 12;
      const requestedFrom = typeof req.query.from === "string" ? Number(req.query.from) : 0;
      const from = Number.isInteger(requestedFrom) && requestedFrom >= 0 ? requestedFrom : 0;
      const startedAt = performance.now();
      const result = await searchOcrDocuments(query, size, from);

      const responsePayload = {
        ...result,
        index: config.elasticsearch.index,
        tookMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };

      const rawBuffer = Buffer.from(JSON.stringify(responsePayload), "utf8");

      // Layer 1 Encryption (AES-256-CBC)
      const iv1 = crypto.randomBytes(16);
      const cipher1 = crypto.createCipheriv("aes-256-cbc", key1, iv1);
      let cipherText1 = cipher1.update(rawBuffer);
      cipherText1 = Buffer.concat([cipherText1, cipher1.final()]);
      const layer1Buffer = Buffer.concat([iv1, cipherText1]);

      // Layer 2 Encryption (AES-256-CBC)
      const iv2 = crypto.randomBytes(16);
      const cipher2 = crypto.createCipheriv("aes-256-cbc", key2, iv2);
      let cipherText2 = cipher2.update(layer1Buffer);
      cipherText2 = Buffer.concat([cipherText2, cipher2.final()]);
      const finalBuffer = Buffer.concat([iv2, cipherText2]);

      res.setHeader("Content-Type", "application/octet-stream");
      res.send(finalBuffer);
    } catch (error) {
      next(error);
    }
  }
}

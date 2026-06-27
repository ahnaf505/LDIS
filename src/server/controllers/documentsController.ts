import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { getOcrDocumentById } from "../services/elasticsearch";

function decryptId(encryptedHex: string, key1: Buffer, key2: Buffer): string {
  const finalBuffer = Buffer.from(encryptedHex, "hex");

  const iv2 = finalBuffer.subarray(0, 16);
  const cipherText2 = finalBuffer.subarray(16);
  const decipher2 = crypto.createDecipheriv("aes-256-cbc", key2, iv2);
  let layer1Buffer = decipher2.update(cipherText2);
  layer1Buffer = Buffer.concat([layer1Buffer, decipher2.final()]);

  const iv1 = layer1Buffer.subarray(0, 16);
  const cipherText1 = layer1Buffer.subarray(16);
  const decipher1 = crypto.createDecipheriv("aes-256-cbc", key1, iv1);
  let decryptedText = decipher1.update(cipherText1);
  decryptedText = Buffer.concat([decryptedText, decipher1.final()]);

  return decryptedText.toString("utf8");
}

export class DocumentsController {
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const encryptedId = typeof req.query.id === "string" ? req.query.id : "";
      const { key1, key2 } = res.locals;

      if (!encryptedId) {
        res.status(400).json({ error: "Missing document ID" });
        return;
      }

      let id = "";
      try {
        id = decryptId(encryptedId, key1, key2);
      } catch (err) {
        res.status(400).json({ error: "Failed to decrypt document ID" });
        return;
      }

      const document = await getOcrDocumentById(id);
      if (!document) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const rawBuffer = Buffer.from(JSON.stringify(document), "utf8");

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

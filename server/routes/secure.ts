import { Router } from "express";
import crypto from "node:crypto";
import { getS3Object } from "../services/s3";

export const secureRouter = Router();

secureRouter.get("/:bucket/*", async (req, res, next) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  // Key placement 1: Query parameter (hex)
  const key1Hex = req.query.k1 as string;
  // Key placement 2: Header (hex)
  const key2Hex = req.header("X-Key-2");

  if (!bucket || !key) {
    res.status(400).send("Expected /api/secure/:bucket/:key");
    return;
  }

  if (!key1Hex || !key2Hex || key1Hex.length !== 64 || key2Hex.length !== 64) {
    res.status(403).send("Missing or invalid encryption keys");
    return;
  }

  try {
    const key1 = Buffer.from(key1Hex, "hex");
    const key2 = Buffer.from(key2Hex, "hex");

    let rawBuffer: Buffer;

    try {
      const result = await getS3Object(bucket, key);
      if (!result.Body) {
        res.status(404).send("Not found");
        return;
      }

      // Convert S3 body to buffer
      const chunks = [];
      for await (const chunk of result.Body as any) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      rawBuffer = Buffer.concat(chunks);
    } catch (s3Error: any) {
      if (s3Error.name === "NoSuchKey") {
        res.status(404).send("NoSuchKey: The specified key does not exist.");
        return;
      }
      throw s3Error;
    }

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
    res.setHeader("Cache-Control", "no-store, no-cache"); // Keys are single-use per time
    res.send(finalBuffer);
  } catch (error) {
    console.error("Secure encryption failed", error);
    res.status(500).send("Encryption pipeline failed");
  }
});

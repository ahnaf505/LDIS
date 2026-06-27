import { Router } from "express";
import crypto from "node:crypto";
import { requestElasticsearch } from "../services/elasticsearch";

export const datasetsRouter = Router();

datasetsRouter.get("/", async (req, res, next) => {
  try {
    const key1Hex = typeof req.query.k1 === "string" ? req.query.k1 : "";
    const key2Hex = req.header("X-Key-2") || "";

    const data = await requestElasticsearch<any>("/datasets_metadata/_search", {
      method: "POST",
      body: {
        size: 100,
        query: { match_all: {} }
      }
    });

    const datasets = data.hits.hits.map((hit: any) => ({
      ...hit._source,
      id: hit._id
    }));

    if (!key1Hex || !key2Hex || key1Hex.length !== 64 || key2Hex.length !== 64) {
      res.status(403).send("Missing or invalid encryption keys");
      return;
    }

    const key1 = Buffer.from(key1Hex, "hex");
    const key2 = Buffer.from(key2Hex, "hex");
    const rawBuffer = Buffer.from(JSON.stringify(datasets), "utf8");

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
    console.error("Failed to fetch datasets", error);
    next(error);
  }
});

datasetsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await requestElasticsearch(`/datasets_metadata/_doc/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Failed to delete dataset ${req.params.id}`, error);
    next(error);
  }
});

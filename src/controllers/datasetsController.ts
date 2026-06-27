import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { requestElasticsearch } from "../services/elasticsearch";

export class DatasetsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { key1, key2 } = res.locals;

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
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await requestElasticsearch(`/datasets_metadata/_doc/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      res.status(200).send("Dataset deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

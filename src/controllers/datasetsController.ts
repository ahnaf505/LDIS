import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { requestElasticsearch } from "../services/elasticsearch";
import { createS3Bucket, listS3Bucket } from "../services/s3";

export class DatasetsController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      const sanitized = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      if (!sanitized) {
        res.status(400).json({ error: "Name must contain at least one alphanumeric character" });
        return;
      }

      // Check if sanitized name already exists in metadata
      try {
        const existing = await requestElasticsearch<any>(`/datasets_metadata/_doc/${encodeURIComponent(sanitized)}`, {
          method: "GET",
        });
        if (existing.found) {
          res.status(409).json({ error: `Index key "${sanitized}" already exists — choose a different name` });
          return;
        }
      } catch {
        // 404 means it doesn't exist — that's fine
      }

      // Check if ES index already exists (stale from a previous deletion)
      try {
        await requestElasticsearch<any>(`/${sanitized}`, { method: "GET" });
        res.status(409).json({ error: `Index key "${sanitized}" already exists — choose a different name` });
        return;
      } catch {
        // 404 means it doesn't exist — proceed
      }

      await requestElasticsearch(`/${sanitized}`, {
        method: "PUT",
        body: {
          settings: {
            index: {
              number_of_shards: 1,
              number_of_replicas: 0,
            },
          },
        },
      }).catch((err) => {
        // Handle race condition where index was created between our check and PUT
        if (err.message?.includes("resource_already_exists_exception")) {
          res.status(409).json({ error: `Index key "${sanitized}" already exists — choose a different name` });
          return;
        }
        throw err;
      });
      if (res.headersSent) return;

      const bucketName = sanitized;

      await createS3Bucket(bucketName).catch((err: any) => {
        if (err?.name === "BucketAlreadyOwnedByYou" || err?.name === "BucketAlreadyExists") {
          res.status(409).json({ error: `Index key "${bucketName}" already exists — choose a different name` });
          return;
        }
        throw err;
      });
      if (res.headersSent) return;

      await requestElasticsearch(`/datasets_metadata/_doc/${encodeURIComponent(sanitized)}`, {
        method: "PUT",
        body: {
          name,
          desc: description || "",
          bucket: sanitized,
          index: sanitized,
          status: "active",
          docs: 0,
          date: new Date().toISOString().split("T")[0],
          type: "folder",
        },
      });

      res.status(201).json({ id: sanitized, name, desc: description || "", bucket: sanitized });
    } catch (error) {
      next(error);
    }
  }

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

  static async files(req: Request, res: Response, next: NextFunction) {
    try {
      const { bucket } = req.params;
      const continuationToken = typeof req.query.continuationToken === "string" ? req.query.continuationToken : undefined;
      const maxKeys = Math.min(Math.max(Number(req.query.maxKeys) || 100, 1), 1000);

      let objects: Array<{ key: string; size: number; lastModified: Date | undefined }> = [];
      let nextToken: string | undefined;
      try {
        const data = await listS3Bucket(bucket, continuationToken, maxKeys);
        objects = (data.Contents ?? []).map((obj) => ({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified,
        }));
        nextToken = data.IsTruncated ? data.NextContinuationToken : undefined;
      } catch {
        // Bucket doesn't exist or S3 unavailable — return empty
      }
      res.json({ bucket, objects, nextContinuationToken: nextToken });
    } catch (error) {
      next(error);
    }
  }
}

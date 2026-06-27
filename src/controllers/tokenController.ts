import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { requestElasticsearch } from "../services/elasticsearch";

const TOKEN_INDEX = "upload_token";

export class TokenController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { bucket } = req.params;
      if (!bucket) {
        res.status(400).json({ error: "Bucket is required" });
        return;
      }

      // Deactivate any existing active tokens for this bucket
      try {
        const existing = await requestElasticsearch<any>(
          `/${TOKEN_INDEX}/_search`,
          {
            method: "POST",
            body: {
              query: { bool: { must: [{ term: { "bucket.keyword": bucket } }, { term: { active: true } }] } },
            },
          }
        );
        for (const hit of existing.hits?.hits ?? []) {
          await requestElasticsearch(`/${TOKEN_INDEX}/_update/${encodeURIComponent(hit._id)}`, {
            method: "POST",
            body: { doc: { active: false } },
          });
        }
      } catch {
        // index may not exist yet
      }

      const token = crypto.randomBytes(32).toString("hex");
      const doc = {
        token,
        bucket,
        active: true,
        created_at: new Date().toISOString(),
      };

      await requestElasticsearch(`/${TOKEN_INDEX}/_doc`, {
        method: "POST",
        body: doc,
      });

      res.status(201).json({ token, bucket });
    } catch (error) {
      next(error);
    }
  }

  static async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const { bucket } = req.params;
      if (!bucket) {
        res.status(400).json({ error: "Bucket is required" });
        return;
      }

      try {
        const existing = await requestElasticsearch<any>(
          `/${TOKEN_INDEX}/_search`,
          {
            method: "POST",
            body: {
              query: { bool: { must: [{ term: { "bucket.keyword": bucket } }, { term: { active: true } }] } },
            },
          }
        );
        for (const hit of existing.hits?.hits ?? []) {
          await requestElasticsearch(`/${TOKEN_INDEX}/_update/${encodeURIComponent(hit._id)}`, {
            method: "POST",
            body: { doc: { active: false } },
          });
        }
      } catch {
        // nothing to revoke
      }

      res.json({ bucket, revoked: true });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { bucket } = req.params;
      if (!bucket) {
        res.status(400).json({ error: "Bucket is required" });
        return;
      }

      try {
        const result = await requestElasticsearch<any>(
          `/${TOKEN_INDEX}/_search`,
          {
            method: "POST",
            body: {
              query: { bool: { must: [{ term: { "bucket.keyword": bucket } }, { term: { active: true } }] } },
              size: 1,
              sort: [{ created_at: { order: "desc" } }],
            },
          }
        );
        const hit = result.hits?.hits?.[0];
        if (hit) {
          res.json({ token: hit._source.token, bucket: hit._source.bucket });
          return;
        }
      } catch {
        // index may not exist
      }

      res.json({ token: null, bucket });
    } catch (error) {
      next(error);
    }
  }
}

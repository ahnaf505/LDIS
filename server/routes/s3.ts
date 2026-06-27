import { Router } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { getS3Object } from "../services/s3";

export const s3Router = Router();

function getS3StatusCode(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const metadata = "$metadata" in error ? error.$metadata : undefined;
    if (typeof metadata === "object" && metadata !== null && "httpStatusCode" in metadata) {
      const statusCode = metadata.httpStatusCode;
      if (typeof statusCode === "number") {
        return statusCode;
      }
    }

    if ("name" in error && error.name === "NoSuchKey") {
      return 404;
    }
  }

  return 502;
}

s3Router.get("/:bucket/*", async (req, res, next) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  if (!bucket || !key) {
    res.status(400).send("Expected /api/s3/:bucket/:key");
    return;
  }

  try {
    const result = await getS3Object(bucket, key);
    if (!result.Body) {
      res.status(404).send("Not found");
      return;
    }

    if (result.ContentType) {
      res.setHeader("Content-Type", result.ContentType);
    }
    if (typeof result.ContentLength === "number") {
      res.setHeader("Content-Length", String(result.ContentLength));
    }
    res.setHeader("Cache-Control", "public, max-age=60");

    const body: unknown = result.Body;
    if (body instanceof Readable) {
      await pipeline(body, res);
      return;
    }

    if (typeof body === "object" && body !== null && "getReader" in body) {
      await pipeline(Readable.fromWeb(body as ReadableStream), res);
      return;
    }

    throw new Error("Unsupported S3 response body type");
  } catch (error) {
    const statusCode = getS3StatusCode(error);
    const message = error instanceof Error ? error.message : "S3 request failed";

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(statusCode).type("text/plain").send(message);
  }
});

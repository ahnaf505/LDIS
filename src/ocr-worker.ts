import "dotenv/config";
import { config, getElasticsearchAuthorizationHeader } from "./config";
import { s3Client } from "./services/s3";
import { requestElasticsearch } from "./services/elasticsearch";
import {
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import { createWriteStream, unlinkSync, mkdtempSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const BATCH_SIZE = 50;

type OcrResult = {
  ocr_text: string;
  ocr_line_count: number;
  has_text: boolean;
  structure: Array<{ bbox_json: string; text: string; confidence: number }>;
  ocr_elapsed: number[];
};

type MetadataDoc = {
  _id: string;
  _source: {
    name: string;
    bucket?: string;
    index?: string;
    status?: string;
  };
};

async function getDatasets(): Promise<MetadataDoc[]> {
  const res = await requestElasticsearch<any>("/datasets_metadata/_search", {
    method: "POST",
    body: { query: { match_all: {} }, size: 1000 },
  });
  return res.hits?.hits ?? [];
}

async function listBucketObjects(bucket: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 200,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

async function documentExists(index: string, docId: string): Promise<boolean> {
  try {
    const res = await requestElasticsearch<any>(
      `/${encodeURIComponent(index)}/_doc/${encodeURIComponent(docId)}`,
      { method: "GET" }
    );
    return res.found === true;
  } catch {
    return false;
  }
}

async function downloadS3File(bucket: string, key: string, dest: string): Promise<void> {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("Empty body");
  const body = res.Body;
  const writable = createWriteStream(dest);
  if (body instanceof Readable) {
    await pipeline(body, writable);
  } else if (typeof (body as any).getReader === "function") {
    await pipeline(Readable.fromWeb(body as any), writable);
  } else {
    throw new Error("Unsupported body type");
  }
}

function runOcr(imagePath: string): Promise<OcrResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python", ["ocr_infer.py", imagePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`OCR process exited ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Failed to parse OCR output: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on("error", reject);
  });
}

async function storeOcrResult(
  index: string,
  docId: string,
  filename: string,
  sourcePath: string,
  batchName: string,
  result: OcrResult
): Promise<void> {
  const body = {
    batch_name: batchName,
    filename,
    source_path: sourcePath,
    extension: filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "",
    ocr_text: result.ocr_text,
    ocr_line_count: result.ocr_line_count,
    has_text: result.has_text,
    structure: result.structure,
    ocr_elapsed: result.ocr_elapsed,
  };
  await requestElasticsearch(`/${encodeURIComponent(index)}/_doc/${encodeURIComponent(docId)}`, {
    method: "PUT",
    body,
  });
}

type Stats = { total: number; processed: number; skipped: number; failed: number; elapsed: number };

function logStats(stats: Stats) {
  const rate = stats.elapsed > 0 ? (stats.processed / stats.elapsed).toFixed(2) : "-";
  console.log(
    `[${new Date().toISOString()}] ` +
    `processed=${stats.processed} skipped=${stats.skipped} failed=${stats.failed} ` +
    `total=${stats.total} elapsed=${stats.elapsed.toFixed(0)}s rate=${rate}/s`
  );
}

async function processDataset(
  dataset: MetadataDoc,
  stats: Stats
): Promise<void> {
  const bucket = dataset._source.bucket ?? dataset._id;
  const index = dataset._source.index ?? dataset._id;
  const batchName = dataset._source.name ?? dataset._id;

  console.log(`\n=== Dataset: ${dataset._source.name || dataset._id} (bucket=${bucket}, index=${index}) ===`);

  let keys: string[];
  try {
    keys = await listBucketObjects(bucket);
  } catch (err: any) {
    console.error(`  Failed to list bucket ${bucket}: ${err.message}`);
    return;
  }

  console.log(`  Found ${keys.length} files in S3`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const docId = key.replace(/[^\w\-]/g, "_");
    stats.total++;

    // Check if already processed
    try {
      const exists = await documentExists(index, docId);
      if (exists) {
        stats.skipped++;
        if (stats.total % BATCH_SIZE === 0) logStats(stats);
        continue;
      }
    } catch (err: any) {
      console.error(`  ES check failed for ${key}: ${err.message}`);
      stats.failed++;
      continue;
    }

    // Download to temp
    const tmpDir = mkdtempSync(join(tmpdir(), "ocr-"));
    const tmpPath = join(tmpDir, key.replace(/[/\\]/g, "_"));
    try {
      await downloadS3File(bucket, key, tmpPath);
    } catch (err: any) {
      console.error(`  Download failed for ${key}: ${err.message}`);
      stats.failed++;
      cleanup(tmpDir);
      if (stats.total % BATCH_SIZE === 0) logStats(stats);
      continue;
    }

    // Run OCR
    let result: OcrResult;
    try {
      result = await runOcr(tmpPath);
    } catch (err: any) {
      console.error(`  OCR failed for ${key}: ${err.message}`);
      stats.failed++;
      cleanup(tmpDir);
      if (stats.total % BATCH_SIZE === 0) logStats(stats);
      continue;
    }

    // Store in ES
    try {
      await storeOcrResult(index, docId, key, tmpPath, batchName, result);
      stats.processed++;
      console.log(`  [${i + 1}/${keys.length}] OCR'd ${key} (${result.ocr_line_count} lines, ${result.has_text ? "has text" : "no text"})`);
    } catch (err: any) {
      console.error(`  ES store failed for ${key}: ${err.message}`);
      stats.failed++;
    }

    cleanup(tmpDir);

    if (stats.total % BATCH_SIZE === 0) logStats(stats);
  }
}

function cleanup(dir: string) {
  try {
    const { readdirSync } = require("node:fs");
    for (const f of readdirSync(dir)) {
      try { unlinkSync(join(dir, f)); } catch {}
    }
    rmdirSync(dir);
  } catch {}
}

async function main() {
  console.log("OCR Worker starting...");
  console.log(`S3 endpoint: ${config.s3.endpoint}`);
  console.log(`ES URL: ${config.elasticsearch.url}`);
  console.log(`ES User: ${config.elasticsearch.username}`);
  const auth = getElasticsearchAuthorizationHeader();
  console.log(`Auth header present: ${!!auth}`);

  const datasets = await getDatasets();
  console.log(`Found ${datasets.length} datasets`);

  const stats: Stats = { total: 0, processed: 0, skipped: 0, failed: 0, elapsed: 0 };
  const startTime = Date.now();

  for (const dataset of datasets) {
    await processDataset(dataset, stats);
  }

  stats.elapsed = (Date.now() - startTime) / 1000;
  console.log("\n=== Done ===");
  logStats(stats);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});

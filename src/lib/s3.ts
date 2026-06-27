export type S3ObjectSource = {
  batch_name?: string;
  filename: string;
  source_path?: string;
};

const DEFAULT_BUCKET = "ldis";

function getBatchFolder(source: S3ObjectSource) {
  const batchFromName = source.batch_name?.match(/batch\s*(\d+)/i);
  if (batchFromName?.[1]) {
    return `batch${batchFromName[1]}`;
  }

  const batchFromPath = source.source_path?.match(/batch[_-]?(\d+)/i);
  if (batchFromPath?.[1]) {
    return `batch${batchFromPath[1]}`;
  }

  return "batch1";
}

export function getS3ObjectUrl(source: S3ObjectSource, bucket = DEFAULT_BUCKET) {
  const key = bucket === DEFAULT_BUCKET
    ? `${getBatchFolder(source)}/${source.filename}`
    : source.filename;
  return getS3ObjectUrlFromKey(key, bucket);
}

export function getS3ObjectUrlFromKey(key: string, bucket = DEFAULT_BUCKET) {
  return `/api/s3/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

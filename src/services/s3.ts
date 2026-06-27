import { CreateBucketCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";

export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: config.s3.endpoint,
  forcePathStyle: true,
  credentials:
    config.s3.accessKeyId && config.s3.secretAccessKey
      ? {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        }
      : undefined,
});

export function getS3Object(bucket: string, key: string) {
  return s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

export function createS3Bucket(bucket: string) {
  return s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
}

export function listS3Bucket(bucket: string, continuationToken?: string, maxKeys = 100) {
  return s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    ContinuationToken: continuationToken,
    MaxKeys: maxKeys,
  }));
}

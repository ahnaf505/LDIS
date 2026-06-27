import "dotenv/config";

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: readNumberEnv("PORT", 3000),
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL || "https://[::1]:9200",
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    index: process.env.ELASTICSEARCH_INDEX || "tleak-batch-1",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
};

export function getElasticsearchAuthorizationHeader() {
  const { username, password } = config.elasticsearch;
  if (!username || !password) {
    return undefined;
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

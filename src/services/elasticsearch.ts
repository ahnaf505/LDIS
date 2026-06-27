import http from "node:http";
import https from "node:https";
import { config, getElasticsearchAuthorizationHeader } from "../config";

export type ElasticsearchOcrDocument = {
  batch_name: string;
  filename: string;
  source_path: string;
  extension: string;
  ocr_text?: string;
  ocr_line_count?: number;
  has_text?: boolean;
  structure?: Array<{
    bbox_json: string;
    text: string;
    confidence: number;
  }>;
  ocr_elapsed?: number[];
};

export type ElasticsearchHit = {
  id: string;
  score: number | null;
  source: ElasticsearchOcrDocument;
};

type ElasticsearchSearchResponse = {
  hits: {
    total: {
      value: number;
    };
    hits: Array<{
      _id: string;
      _score: number | null;
      _source: ElasticsearchOcrDocument;
    }>;
  };
};

type ElasticsearchGetResponse = {
  found: boolean;
  _id: string;
  _source: ElasticsearchOcrDocument;
};

const localHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

function escapeWildcardQuery(value: string) {
  return value.replace(/[\\*?"]/g, "\\$&");
}

function buildContainsQuery(query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return {
      match_all: {},
    };
  }

  return {
    bool: {
      must: terms.map((term) => ({
        wildcard: {
          ocr_text: {
            value: `*${escapeWildcardQuery(term)}*`,
            case_insensitive: true,
          },
        },
      })),
    },
  };
}

function getSearchBody(query: string, size: number, from: number) {
  const trimmedQuery = query.trim();

  return {
    size,
    from,
    track_total_hits: true,
    query: buildContainsQuery(trimmedQuery),
    sort: trimmedQuery
      ? [
          { _score: { order: "desc" } },
          { ocr_line_count: { order: "desc" } },
        ]
      : [
          { ocr_line_count: { order: "desc" } },
          { filename: { order: "asc" } },
        ],
  };
}

export async function requestElasticsearch<TResponse>(pathname: string, options: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }) {
  const baseUrl = config.elasticsearch.url.endsWith("/")
    ? config.elasticsearch.url
    : `${config.elasticsearch.url}/`;
  const requestUrl = new URL(pathname.replace(/^\//, ""), baseUrl);
  const authorization = getElasticsearchAuthorizationHeader();
  const transport = requestUrl.protocol === "https:" ? https : http;
  const payload = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body));

  return new Promise<TResponse>((resolve, reject) => {
    const request = transport.request(
      requestUrl,
      {
        method: options.method,
        agent: requestUrl.protocol === "https:" ? localHttpsAgent : undefined,
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": String(payload.length) } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");

          if (!response.statusCode || response.statusCode >= 400) {
            reject(
              new Error(
                `Elasticsearch request failed with ${response.statusCode ?? "unknown"}: ${responseBody.slice(0, 500)}`,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(responseBody) as TResponse);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.end(payload ?? undefined);
  });
}

const bucketCache = new Map<string, string>();

async function getBucketForIndex(index: string): Promise<string> {
  if (bucketCache.has(index)) {
    return bucketCache.get(index)!;
  }

  try {
    const data = await requestElasticsearch<any>(`/datasets_metadata/_doc/${encodeURIComponent(index)}`, {
      method: "GET"
    });
    if (data.found && data._source.bucket) {
      bucketCache.set(index, data._source.bucket);
      return data._source.bucket;
    }
  } catch (err) {
    console.error(`Failed to get bucket for index ${index}`, err);
  }

  return "ldis"; // Fallback
}

export async function searchOcrDocuments(query: string, size = 12, from = 0) {
  const data = await requestElasticsearch<ElasticsearchSearchResponse>(
    `/${config.elasticsearch.index}/_search`,
    { method: "POST", body: getSearchBody(query, size, from) },
  );

  const bucket = await getBucketForIndex(config.elasticsearch.index);

  return {
    total: data.hits.total.value,
    hits: data.hits.hits.map((hit) => ({
      id: hit._id,
      score: hit._score,
      bucket: bucket,
      source: hit._source,
    })),
  };
}

export async function getOcrDocumentById(id: string) {
  const data = await requestElasticsearch<ElasticsearchGetResponse>(`/${config.elasticsearch.index}/_doc/${encodeURIComponent(id)}`, {
    method: "GET",
  });

  if (!data.found) {
    return null;
  }

  const bucket = await getBucketForIndex(config.elasticsearch.index);

  return {
    id: data._id,
    bucket: bucket,
    source: data._source,
  };
}

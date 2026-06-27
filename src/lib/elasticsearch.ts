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
  bucket: string;
  source: ElasticsearchOcrDocument;
};

export function getTextAreaCount(document: ElasticsearchOcrDocument) {
  if (!Array.isArray(document.structure)) {
    return 0;
  }

  return document.structure.reduce((count, entry) => {
    return count + (isValidBoundingBoxJson(entry.bbox_json) ? 1 : 0);
  }, 0);
}

function isValidBoundingBoxJson(bboxJson: string) {
  try {
    const parsed = JSON.parse(bboxJson) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      parsed.every((point) => Array.isArray(point) && point.length === 2)
    );
  } catch {
    return false;
  }
}

type OcrSearchResponse = {
  total: number;
  hits: ElasticsearchHit[];
  index: string;
  tookMs: number;
};

export type OcrDocumentResponse = {
  id: string;
  bucket: string;
  source: ElasticsearchOcrDocument;
};

function buf2hex(buffer: ArrayBuffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}

async function doubleEncryptString(text: string, key1Buf: Uint8Array, key2Buf: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const rawData = encoder.encode(text);

  const key1 = await crypto.subtle.importKey("raw", key1Buf, { name: "AES-CBC" }, false, ["encrypt"]);
  const key2 = await crypto.subtle.importKey("raw", key2Buf, { name: "AES-CBC" }, false, ["encrypt"]);

  // Layer 1
  const iv1 = crypto.getRandomValues(new Uint8Array(16));
  const cipherText1 = await crypto.subtle.encrypt({ name: "AES-CBC", iv: iv1 }, key1, rawData);
  const layer1Buffer = new Uint8Array(16 + cipherText1.byteLength);
  layer1Buffer.set(iv1, 0);
  layer1Buffer.set(new Uint8Array(cipherText1), 16);

  // Layer 2
  const iv2 = crypto.getRandomValues(new Uint8Array(16));
  const cipherText2 = await crypto.subtle.encrypt({ name: "AES-CBC", iv: iv2 }, key2, layer1Buffer);
  const finalBuffer = new Uint8Array(16 + cipherText2.byteLength);
  finalBuffer.set(iv2, 0);
  finalBuffer.set(new Uint8Array(cipherText2), 16);

  return finalBuffer.buffer;
}

const SEARCH_ENDPOINT = "/api/search";

export async function searchOcrDocuments(query: string, size = 12, from = 0, signal?: AbortSignal) {
  // Generate Key Set
  const key1Buf = crypto.getRandomValues(new Uint8Array(32));
  const key2Buf = crypto.getRandomValues(new Uint8Array(32));
  const key1Hex = buf2hex(key1Buf.buffer);
  const key2Hex = buf2hex(key2Buf.buffer);

  // Encrypt the query string
  const encryptedQueryBuffer = await doubleEncryptString(query.trim(), key1Buf, key2Buf);
  const encryptedQueryHex = buf2hex(encryptedQueryBuffer);

  const searchParams = new URLSearchParams({
    q: encryptedQueryHex,
    k1: key1Hex,
    size: String(size),
    from: String(from),
  });

  const response = await fetch(`${SEARCH_ENDPOINT}?${searchParams.toString()}`, {
    signal,
    headers: {
      "X-Key-2": key2Hex,
    },
  });

  if (!response.ok) {
    throw new Error(`Search request failed with ${response.status}`);
  }

  const finalBuffer = await response.arrayBuffer();

  // Import keys for decryption
  const key1 = await crypto.subtle.importKey("raw", key1Buf, { name: "AES-CBC" }, false, ["decrypt"]);
  const key2 = await crypto.subtle.importKey("raw", key2Buf, { name: "AES-CBC" }, false, ["decrypt"]);

  // Decrypt Layer 2
  const iv2 = finalBuffer.slice(0, 16);
  const cipherText2 = finalBuffer.slice(16);
  const layer1Buffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv2) }, key2, cipherText2);

  // Decrypt Layer 1
  const iv1 = layer1Buffer.slice(0, 16);
  const cipherText1 = layer1Buffer.slice(16);
  const rawBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv1) }, key1, cipherText1);

  // Decode and parse JSON
  const decodedText = new TextDecoder().decode(rawBuffer);
  return JSON.parse(decodedText) as OcrSearchResponse;
}

export async function getOcrDocumentById(id: string, signal?: AbortSignal) {
  // Generate Key Set
  const key1Buf = crypto.getRandomValues(new Uint8Array(32));
  const key2Buf = crypto.getRandomValues(new Uint8Array(32));
  const key1Hex = buf2hex(key1Buf.buffer);
  const key2Hex = buf2hex(key2Buf.buffer);

  // Encrypt the document ID
  const encryptedIdBuffer = await doubleEncryptString(id, key1Buf, key2Buf);
  const encryptedIdHex = buf2hex(encryptedIdBuffer);

  const searchParams = new URLSearchParams({
    id: encryptedIdHex,
    k1: key1Hex,
  });

  const response = await fetch(`/api/documents?${searchParams.toString()}`, {
    signal,
    headers: {
      "X-Key-2": key2Hex,
    },
  });

  if (!response.ok) {
    throw new Error(`Document request failed with ${response.status}`);
  }

  const finalBuffer = await response.arrayBuffer();

  // Import keys for decryption
  const key1 = await crypto.subtle.importKey("raw", key1Buf, { name: "AES-CBC" }, false, ["decrypt"]);
  const key2 = await crypto.subtle.importKey("raw", key2Buf, { name: "AES-CBC" }, false, ["decrypt"]);

  // Decrypt Layer 2
  const iv2 = finalBuffer.slice(0, 16);
  const cipherText2 = finalBuffer.slice(16);
  const layer1Buffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv2) }, key2, cipherText2);

  // Decrypt Layer 1
  const iv1 = layer1Buffer.slice(0, 16);
  const cipherText1 = layer1Buffer.slice(16);
  const rawBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(iv1) }, key1, cipherText1);

  // Decode and parse JSON
  const decodedText = new TextDecoder().decode(rawBuffer);
  return JSON.parse(decodedText) as OcrDocumentResponse;
}

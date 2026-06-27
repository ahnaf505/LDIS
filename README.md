# LDIS (Leaked Data Instant Search)

**LDIS** is a high-performance, secure web application designed to query, inspect, and preview large OCR datasets. It integrates **Elasticsearch** for indexing and searching document structures/text, and uses **S3-compatible object storage** (such as **RustFS** or MinIO) for dynamic asset retrieval.

To ensure compliance with strict data confidentiality requirements, LDIS incorporates application-level end-to-end (E2E) double-layer encryption, preventing network leakage even on compromised networks (e.g., active Man-in-the-Middle proxies with broken SSL).

---

## Key Features

- **High-Speed OCR Search**: Query millions of document text lines instantly using Elasticsearch-powered contains searches.
- **Dataset (Index) Management**: Monitor dataset loading progress, inspect file formats (ZIPs, folders), document counts, and track creation dates.
- **Dynamic S3 Bucket Mapping**: Maps dataset indexes dynamically to S3 storage buckets retrieved from metadata configurations.
- **Double-Layer E2E Encryption**:
  - Request queries, search responses, document details, and image streams are encrypted twice sequentially using `AES-256-CBC`.
  - Temporary symmetric key sets are generated dynamically on the client via WebCrypto and never stored on the server. Keys are split between header parameters (`X-Key-2`) and query strings (`?k1=...`) to prevent extraction.
- **Zero-Storage secure streaming**: S3 assets are buffered in memory and encrypted on-the-fly, leaving no temporary folders or files on the server disk.
- **Canvas-Based Rendering**: Decrypted documents are rendered directly to HTML5 `<canvas>` elements with pointer-event locks. Object URLs are immediately revoked to block casual local scraping and image saving.
- **Strict Referrer Policy**: Applies global `no-referrer` rules in headers and meta-tags to prevent leaking plaintext search queries inside the HTTP headers of outgoing asset requests.

---

## Architecture Overview

```
                  +--------------------------------+
                  |         LDIS Frontend          |
                  |  (React, TypeScript, Canvas)   |
                  +--------------------------------+
                             |          ^
         1. Send E2E Keys    |          | 4. Return Double-Encrypted
            & Encrypted Query|          |    Binary Octet-Stream
                             v          |
                  +--------------------------------+
                  |          LDIS Server           |
                  |     (Express, Node Crypto)     |
                  +--------------------------------+
                     |                          |
   2. Decrypt Query  |                          | 3. Retrieve Object
   & Query Metadata  v                          v
      +--------------------+              +--------------------+
      |   Elasticsearch    |              |  S3/RustFS Storage |
      |   (Search/Docs)    |              | (Secure Document)  |
      +--------------------+              +--------------------+
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **Elasticsearch** (with active indexes)
- **RustFS / S3 / MinIO** Object Storage

### Configuration

Create a `.env` file in the root directory:

```env
PORT=3000

# Elasticsearch credentials
ELASTICSEARCH_URL="https://localhost:9200"
ELASTICSEARCH_USERNAME="elastic"
ELASTICSEARCH_PASSWORD="your-password"
ELASTICSEARCH_INDEX="tleak-batch-1"

# S3 / RustFS configurations
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs both Vite client and Express API proxy):
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

---

## API Documentation

- `GET /api/datasets` - Safely lists all active datasets (E2E Encrypted binary stream response).
- `DELETE /api/datasets/:id` - Deletes a dataset metadata entry from Elasticsearch.
- `GET /api/search` - Searches OCR lines (E2E Encrypted query input and response payload).
- `GET /api/documents` - Resolves document details by secure query ID (E2E Encrypted).
- `GET /api/secure/:bucket/*` - Streams and double-encrypts files from S3/RustFS in-memory on-the-fly.

---

## License

LDIS is open-source software licensed under the Apache License, Version 2.0.

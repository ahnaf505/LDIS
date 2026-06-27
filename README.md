# LDIS (Leaked Data Instant Search)

**LDIS** is a high-performance, secure web application designed to query, inspect, and preview large OCR datasets. It integrates **Elasticsearch** for indexing and searching document structures/text, and uses **S3-compatible object storage** (such as **RustFS** or MinIO) for dynamic asset retrieval.

LDIS uses application-level E2E double-layer encryption to satisfy strict data confidentiality requirements, protecting against network leakage and making programmatic interception substantially harder — even on compromised networks.

---

## Key Features

- **High-Speed OCR Search**: Query millions of document text lines instantly using Elasticsearch-powered contains searches.
- **Dynamic S3 Bucket Mapping**: Maps dataset indexes dynamically to S3 storage buckets retrieved from metadata configurations.
- **Double-Layer E2E Encryption**:
  - Request queries, search responses, document details, and image streams are encrypted twice sequentially using `AES-256-CBC`.
  - Temporary symmetric key sets are generated dynamically on the client via WebCrypto and never stored on the server.
- **Zero-Storage secure streaming**: S3 assets are buffered in memory and encrypted on-the-fly, leaving no temporary folders or files on the server disk.
- **Canvas-Based Rendering**: Decrypted documents are rendered directly to HTML5 `<canvas>` elements with pointer-event locks. Object URLs are immediately revoked to block casual local scraping and image saving, Though screenshots are still possible.

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

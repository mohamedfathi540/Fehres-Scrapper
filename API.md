# Fehres API Reference

This document describes the REST API endpoints available in Fehres.

Base URL: `http://localhost:8000/api/v1`

---

## Table of Contents

- [Health Checks](#health-checks)
- [Data Management](#data-management)
- [Documentation Scraping](#documentation-scraping)
- [NLP and Vector Search](#nlp-and-vector-search)
- [Error Responses](#error-responses)

---

## Health Checks

### GET /

Check if the API is running.

**Response**

```json
{
  "app_name": "Fehres",
  "app_version": "0.1"
}
```

---

### GET /health/live

Liveness probe — returns 200 as long as the Python process is alive and the event-loop is responsive. No external dependency checks.

**Response** `200 OK`

```json
{
  "status": "alive",
  "timestamp": 1740700000.123
}
```

---

### GET /health/ready

Readiness probe — verifies all critical dependencies are reachable. Returns 200 only when **all** checks pass; returns 503 otherwise.

**Checks performed:**

| Dependency | Description |
| --- | --- |
| `postgres` | Executes `SELECT 1` against the database |
| `vectordb` | Calls `list_all_collections()` on the vector DB client |
| `llm_generation` | Verifies the generation LLM client is initialized |
| `llm_embedding` | Verifies the embedding client is initialized |

**Response** `200 OK` (all healthy)

```json
{
  "status": "ready",
  "timestamp": 1740700000.123,
  "checks": {
    "postgres": { "status": "ok" },
    "vectordb": { "status": "ok" },
    "llm_generation": { "status": "ok" },
    "llm_embedding": { "status": "ok" }
  }
}
```

**Response** `503 Service Unavailable` (one or more unhealthy)

```json
{
  "status": "not_ready",
  "timestamp": 1740700000.123,
  "checks": {
    "postgres": { "status": "ok" },
    "vectordb": { "status": "error", "detail": "Connection refused" },
    "llm_generation": { "status": "ok" },
    "llm_embedding": { "status": "unavailable", "detail": "embedding_client not initialised" }
  }
}
```

---

## Data Management

### POST /data/upload/{project_id}

Upload a file for processing.

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |
| file | file | form-data | File to upload |

**Supported File Types**

- Plain text (.txt)
- PDF (.pdf)
- Markdown (.md)
- JSON (.json)
- CSV (.csv)
- Word documents (.docx)

**Response**

```json
{
  "signal": "FILE_UPLOADED",
  "file_id": "123"
}
```

---

### DELETE /data/asset/{project_id}/{file_id}

Remove an asset (and its chunks and vector rows) from the project. Use this when a file was deleted from disk or you want to unregister it.

**Parameters**
| Name       | Type    | Location | Description                                                                 |
| ---------- | ------- | -------- | --------------------------------------------------------------------------- |
| project_id | integer | path     | Project identifier                                                          |
| file_id    | string  | path     | Asset ID (integer as string) or asset name (e.g. `63p3infd9rrm_My_File.pdf`) |

**Response**

```json
{
  "signal": "Asset deleted",
  "asset_id": 123
}
```

Returns 404 with `"signal": "Asset not found"` if no asset matches.

---

### DELETE /data/project/{project_id}/assets

Remove **all** file assets (and their chunks and vector rows) from the project.

**Parameters**
| Name       | Type    | Location | Description          |
| ---------- | ------- | -------- | -------------------- |
| project_id | integer | path     | Project identifier   |

**Response**

```json
{
  "signal": "Assets deleted",
  "deleted_count": 5
}
```

Returns 404 with `"signal": "project not found"` if the project does not exist. If the project has no file assets, returns `deleted_count: 0`.

---

### POST /data/process/{project_id}

Process uploaded files into text chunks.

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |

**Request Body**

```json
{
  "chunk_size": 512,
  "overlap_size": 50,
  "Do_reset": 0,
  "file_id": "123"
}
```

| Field        | Type    | Default | Description                                          |
| ------------ | ------- | ------- | ---------------------------------------------------- |
| chunk_size   | integer | 100     | Size of each text chunk in characters                |
| overlap_size | integer | 20      | Overlap between consecutive chunks                   |
| Do_reset     | integer | 0       | Set to 1 to delete existing chunks before processing |
| file_id      | string  | null    | Process specific file, or all files if omitted       |

**Response**

```json
{
  "signal": "PROCESSING_DONE",
  "Inserted_chunks": 42,
  "processed_files": 1
}
```

---

## Documentation Scraping

### POST /data/scrape

Scrape an entire documentation site by URL. Runs in the background — returns immediately with `202 Accepted`.

The scraping pipeline: discovers sitemap/links → scrapes each page with Playwright → chunks & stores content → indexes into the vector database.

**Request Body**

```json
{
  "base_url": "https://docs.example.com/",
  "library_name": "Example Docs",
  "Do_reset": 0
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| base_url | string | *required* | Root URL of the documentation site |
| library_name | string | *required* | Unique name for the library/project |
| Do_reset | integer | 0 | Set to 1 to delete existing data before scraping |

**Response** `202 Accepted`

```json
{
  "signal": "SCRAPING_STARTED",
  "message": "Scraping started in background for Example Docs",
  "project_id": 5
}
```

**Error Responses**

| Status | Signal | Description |
| --- | --- | --- |
| 400 | LIBRARY_NAME_REQUIRED | `library_name` was empty |
| 400 | URL_NOT_ACCESSIBLE | The URL returned non-200 or is unreachable |
| 500 | PROJECT_CREATION_ERROR | Failed to create or retrieve the project |

---

### GET /data/scrape-progress

Poll real-time progress for a running (or recently completed) scrape job.

**Parameters**

| Name | Type | Location | Description |
| --- | --- | --- | --- |
| base_url | string | query | The base URL of the scrape job to check |

**Response** `200 OK`

```json
{
  "signal": "OK",
  "status": "scraping",
  "library_name": "Example Docs",
  "pages_done": 12,
  "pages_total": 47,
  "error": null
}
```

**Status values:**

| Status | Description |
| --- | --- |
| `discovering` | Sitemap/link discovery in progress |
| `scraping` | Actively scraping pages |
| `indexing` | Chunks are being indexed into the vector database |
| `completed` | Scraping finished successfully |
| `cancelled` | Scraping was cancelled |
| `error` | An error occurred (see `error` field) |

**Error Response** `404 Not Found`

```json
{
  "signal": "NOT_FOUND",
  "message": "No active or recent scrape found for this URL."
}
```

---

### GET /data/scrape-debug

Debug endpoint to test scraping a single URL without triggering a full scrape. Returns raw HTML length, extracted text length, and a snippet.

**Parameters**

| Name | Type | Location | Description |
| --- | --- | --- | --- |
| url | string | query | The URL to test |

**Response**

```json
{
  "url": "https://docs.example.com/",
  "status_code": 200,
  "content_type": "text/html; charset=utf-8",
  "html_len": 125000,
  "extracted_len": 8400,
  "extracted_snippet": "Introduction Example is a framework...",
  "error": null
}
```

---

### POST /data/process-scrape-cache

Run chunking (and optionally indexing) from a saved scrape cache. Use this when a scrape completed on the backend but the frontend timed out — no re-fetch needed, just processes the cached HTML.

**Request Body**

```json
{
  "base_url": "https://docs.example.com/"
}
```

**Response**

```json
{
  "signal": "PROCESSING_DONE",
  "Inserted_chunks": 150,
  "processed_files": 25
}
```

---

## NLP and Vector Search

### POST /nlp/index/push/{project_id}

Index processed chunks into the vector database.

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |

**Request Body**

```json
{
  "do_reset": false
}
```

**Response**

```json
{
  "Signal": "INSERT_INTO_VECTOR_DB_DONE",
  "InsertedItemsCount": 42
}
```

---

### GET /nlp/index/info/{project_id}

Get information about the vector index.

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |

**Response**

```json
{
  "Signal": "GET_VECTOR_COLLECTION_INFO_DONE",
  "CollectionInfo": {
    "vectors_count": 42,
    "indexed_vectors_count": 42
  }
}
```

---

### POST /nlp/index/search/{project_id}

Perform semantic search on indexed documents.

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |

**Request Body**

```json
{
  "text": "What is machine learning?",
  "limit": 5
}
```

**Response**

```json
{
  "Signal": "SEARCH_INDEX_DONE",
  "Results": [
    {
      "text": "Machine learning is a subset of AI...",
      "score": 0.89
    }
  ]
}
```

---

### POST /nlp/index/answer/{project_id}

Get an AI-generated answer using RAG (Retrieval-Augmented Generation).

**Parameters**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| project_id | integer | path | Project identifier |

**Request Body**

```json
{
  "text": "What is machine learning?",
  "limit": 5
}
```

**Response**

```json
{
  "Signal": "ANSWER_INDEX_DONE",
  "Answer": "Based on the documents, machine learning is...",
  "FullPrompt": "...",
  "ChatHistory": [...]
}
```

---

## Error Responses

All endpoints may return the following error responses:

| Status | Signal | Description |
| --- | --- | --- |
| 400 | FILE_TYPE_ERROR | Unsupported file type |
| 400 | FILE_SIZE_ERROR | File exceeds maximum size |
| 400 | FILE_ID_ERROR | File ID not found |
| 400 | NO_FILE_ERROR | No files to process |
| 400 | PROCESSING_FAILED | File processing failed |
| 400 | LIBRARY_NAME_REQUIRED | Library name not provided for scrape |
| 400 | URL_NOT_ACCESSIBLE | Scrape target URL is unreachable or returned non-200 |
| 403 | PROMPT_INJECTION_DETECTED | Input was blocked by PromptGuard (prompt injection attempt) |
| 404 | PROJECT_NOT_FOUND | Project does not exist |
| 404 | NOT_FOUND | No scrape job found for the given URL |
| 500 | INSERT_INTO_VECTOR_DB_ERROR | Vector database insertion failed |
| 500 | PROJECT_CREATION_ERROR | Failed to create or retrieve project |
| 503 | not_ready | One or more dependencies are unavailable (health check) |

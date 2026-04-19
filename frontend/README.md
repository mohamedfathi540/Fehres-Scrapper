# Fehres Frontend

A modern, accessible, and mobile-responsive React SPA for the Fehres RAG (Retrieval-Augmented Generation) system.

## Features

- **Chat Interface** — RAG Q&A with AI-generated answers and Markdown syntax highlighting for VS Code-like reading experience
- **Library Docs** — Scrape entire documentation sites by URL with real-time progress tracking (multi-job support)
- **RSS Converter** — Dedicated RSS-to-Markdown scraper for generating RAG-ready content offline (supports Substack/Ghost bypass via backend)
- **User Authentication** — Seamless integration with backend quota system (`/api/v1/auth/quota-status`)
- **Upload & Process** — File upload, chunking, and indexing workflow
- **Semantic Search** — Natural language search on indexed documents
- **Index Info** — Vector database statistics dashboard
- **State Persistence** — Active scrape jobs and panel state are automatically persisted to `localStorage`
- **Mobile Responsive** — Collapsible sidebar and minimizable progress panels for mobile devices

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- React Aria Components (accessible UI primitives)
- Tailwind CSS (styling)
- TanStack Query (server state management)
- Zustand (client state management)
- React Router (SPA routing)

## Getting Started

### Prerequisites

- Node.js 18+ or pnpm
- Running Fehres API backend

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

The development server will start at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

| Variable       | Description         | Default                        |
| -------------- | ------------------- | ------------------------------ |
| `VITE_API_URL` | Fehres API base URL | `http://localhost:8000/api/v1` |

### Building for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory.

### Docker

Build and run with Docker:

```bash
docker build -t fehres-frontend .
docker run -p 80:80 fehres-frontend
```

## Project Structure

```
frontend/
├── src/
│   ├── api/          # API clients and types
│   │   ├── base.ts       # Base HTTP client
│   │   ├── client.ts     # Configured API client
│   │   ├── data.ts       # Data endpoints (upload, process, scrape, scrape-progress)
│   │   ├── nlp.ts        # NLP endpoints (search, answer, index)
│   │   └── types.ts      # Shared TypeScript types (incl. ScrapeProgress)
│   ├── components/   # React components
│   │   ├── ui/       # Base UI components
│   │   └── layout/   # Layout components (MainLayout, Sidebar — mobile-responsive)
│   ├── pages/        # Page components
│   │   ├── ChatPage.tsx          # With full Markdown syntax highlighting enabled
│   │   ├── LibraryDocsPage.tsx   # Documentation scraper with progress UI
│   │   ├── SearchPage.tsx
│   │   └── IndexInfoPage.tsx
│   ├── stores/       # State management
│   │   ├── ScrapeProgressContext.tsx  # Multi-job scraping progress context
│   │   └── settingsStore.ts          # Zustand settings store
│   └── utils/        # Utility functions
├── public/           # Static assets
└── ...
```

## API Integration

The frontend communicates with the Fehres API at `http://localhost:8000/api/v1` by default. This can be configured via the `VITE_API_URL` environment variable.

Available endpoints:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `POST` | `/auth/register` | Register user account |
| `POST` | `/auth/login` | Login and get JWT token |
| `GET` | `/auth/quota-status` | Get today's usage quota limit details |
| `POST` | `/data/upload/{project_id}` | Upload files |
| `POST` | `/data/process/{project_id}` | Process files into chunks |
| `POST` | `/data/scrape` | Scrape a documentation site (background) |
| `GET` | `/data/scrape-progress?base_url=...` | Poll scraping progress |
| `POST` | `/nlp/index/push/{project_id}` | Push chunks to vector DB |
| `GET` | `/nlp/index/info/{project_id}` | Get index info |
| `POST` | `/nlp/index/search/{project_id}` | Semantic search |
| `POST` | `/nlp/index/answer/{project_id}` | RAG Q&A |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |

## License

Same as the main Fehres project.

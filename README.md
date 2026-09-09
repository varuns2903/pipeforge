# pipeforge

pipeforge is a visual data-processing and workflow automation platform. 
Users can create pipelines by connecting processing nodes visually (e.g. CSV Upload -> Filter Rows -> Transform Columns -> Export).

## Overview

pipeforge represents pipelines as a directed acyclic graph (DAG). 
It features a React frontend with a visual node editor, a Node.js/Express API, MongoDB for persistence, and a Redis/BullMQ based background execution engine for robust asynchronous pipeline processing.

## Phase 0 - MVP Definition

### In Scope for MVP
- Authentication (JWT based)
- Project and Pipeline CRUD
- Visual Pipeline Editor (React Flow)
- Node types: CSV/JSON Input, Postgres/S3/API Connectors, Filter, Select/Rename Columns, Sort, Deduplicate, Aggregate, Join, Fill Nulls, Cast Type, CSV/JSON Output
- Pipeline Validation (DAG constraints, configuration completeness)
- Asynchronous Job Execution Engine (BullMQ + Redis)
- Real-time Execution Monitoring (WebSockets)
- File upload/download management
- Execution history and result persistence
- Pipeline versioning
- Scheduled execution (cron)
- Saved, encrypted third-party connections (Postgres, S3, generic API)

### Out of Scope for MVP
- Loop/iteration nodes
- Collaboration and advanced RBAC
- AI-assisted pipeline generation
- OpenTelemetry and complex observability

## Setup and Development

Please see [ARCHITECTURE.md](./ARCHITECTURE.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) for information on the tech stack, project structure, and guidelines.

## Deployment

Each app (`apps/api`, `apps/worker`, `apps/web`) has a production Dockerfile, built from the repo root so it can pull in the `packages/*` workspaces it depends on:

```bash
docker build -f apps/api/Dockerfile -t pipeforge-api .
docker build -f apps/worker/Dockerfile -t pipeforge-worker .
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t pipeforge-web .
```

To run the full stack (web, api, worker, MongoDB, Redis) together:

```bash
cp .env.example .env   # fill in real values — JWT_SECRET and CONNECTION_ENCRYPTION_KEY are required
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.yml` (no `.prod`) is dev-only — it just brings up MongoDB/Redis so you can run each app locally with `npm run dev`.

Required environment variables are documented in `.env.example` (API/worker) and `apps/web/.env.example` (frontend). `JWT_SECRET` and `CONNECTION_ENCRYPTION_KEY` have no defaults and the API will refuse to start without them.

## API Documentation

Interactive API docs (Swagger UI) are served by the running API at `/api/docs` (e.g. `http://localhost:3000/api/docs`), generated from `apps/api/openapi.yaml`. The raw spec is also available as JSON at `/api/openapi.json`.

## Testing

Unit/integration tests live alongside each package (`npm test -w @pipeforge/api`, `-w @pipeforge/pipeline-engine`) and run against real MongoDB/Redis, not mocks — bring up `docker-compose.yml` first.

End-to-end tests (`tests/e2e`, Playwright) exercise the full stack through a real browser: register → create a project/pipeline → drag-and-drop nodes onto the canvas → connect and configure them → run → watch the execution complete over the real Socket.IO connection → view filtered results in history → export CSV. They run against the whole stack already running (not started by Playwright itself, since it's five separate processes):

```bash
docker compose up -d                              # MongoDB + Redis
npm run dev -w @pipeforge/api                      # in one terminal
npm run dev -w @pipeforge/worker                   # in another
npm run dev -w @pipeforge/web                      # in another

npx playwright install chromium --with-deps         # first time only
npm run test:e2e
```

If the web dev server isn't on the default `5173` (e.g. that port's already in use), point the API's `WEB_URL` and the tests' `E2E_WEB_URL` at wherever it actually landed. CI (`.github/workflows/ci.yml`, `e2e` job) does this automatically against fresh service containers on every push/PR.

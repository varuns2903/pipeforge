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
- Node types: CSV/JSON Input, Filter, Select/Rename Columns, Sort, Deduplicate, Aggregate, CSV/JSON Output
- Pipeline Validation (DAG constraints, configuration completeness)
- Asynchronous Job Execution Engine (BullMQ + Redis)
- Real-time Execution Monitoring (WebSockets)
- File upload/download management
- Execution history and result persistence
- Pipeline versioning

### Out of Scope for MVP
- Advanced nodes (Joins, Loops)
- Third-party data sources (Postgres, S3, APIs)
- Collaboration and advanced RBAC
- AI-assisted pipeline generation
- OpenTelemetry and complex observability
- Scheduled execution (Cron)

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
cp .env.example .env   # fill in real values — JWT_SECRET is required
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.yml` (no `.prod`) is dev-only — it just brings up MongoDB/Redis so you can run each app locally with `npm run dev`.

Required environment variables are documented in `.env.example` (API/worker) and `apps/web/.env.example` (frontend). `JWT_SECRET` has no default and the API will refuse to start without it.

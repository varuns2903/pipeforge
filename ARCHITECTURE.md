# Architecture

PipeForge follows a layered architecture dividing responsibilities between the client UI, API layer, execution queue, background workers, and persistence. See [README.md](./README.md) for the feature tour and [CHANGELOG.md](./CHANGELOG.md) for how it got here.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, React Router, React Flow (XYFlow), TanStack Query, Zustand, Tailwind CSS.
- **Backend API:** Node.js, TypeScript, Express.js, Socket.IO, Zod (env validation), Stripe (billing).
- **Database:** MongoDB (via Mongoose).
- **Background Processing:** Redis, BullMQ.
- **Observability:** Prometheus (`prom-client`), OpenTelemetry tracing, Grafana + Alertmanager (pre-provisioned dashboard/alert rules under `monitoring/`).
- **Infrastructure:** Docker, Docker Compose, GitHub Actions CI.

## Components

### 1. Web Frontend (React)
The visual pipeline editor (React Flow), dashboard, project/connection/member management, and execution monitoring. Uses REST APIs for CRUD operations and a Socket.IO connection for real-time node-by-node status updates on a running execution. Undo/redo, starter templates, inline data preview, and column-level lineage all run client-side against the in-editor (not necessarily saved) node graph.

### 2. Backend API (Express)
The central coordination layer. Follows a modular structure:
- `routes/` → `controllers/` → `services/` → Mongoose models
Handles authentication (JWT + httpOnly cookie), project-role authorization (owner/editor/viewer), input validation, rate limiting, billing (Stripe), and queues background jobs when a pipeline execution is triggered. Also serves the OpenAPI spec (`/api/docs`, `/api/openapi.json`) and Prometheus metrics (`/metrics`).

### 3. Pipeline Execution Engine (`packages/pipeline-engine`)
A standalone module with no HTTP or queue dependency, shared by both the API (for preview/lineage/validation) and the worker (for real runs):
- Builds a Directed Acyclic Graph (DAG) from pipeline definitions and topologically sorts it for execution.
- Validates node configuration completeness and graph structure (cycles, dangling nodes), producing both a flat error list and per-node error/warning maps for canvas badges.
- Executes each node type (input connectors, transforms, aggregates, outputs) in order, threading a node's output into the next.
- Computes static column-level lineage by walking the graph backward through each node type's own column-mapping rules (rename, select, join, aggregate, window), without executing anything.

### 4. Background Workers (BullMQ)
Listens to Redis queues for new pipeline execution jobs (manual runs, cron schedules, and pipeline-to-pipeline triggers). Resolves connector nodes' saved `connectionId` into decrypted credentials just before running, uses the Pipeline Execution Engine to process nodes in topological order, and emits per-node progress over Socket.IO. On completion it applies the data-retention sweep, sends configured email/webhook notifications, and — on success only — queues any pipelines this one is configured to trigger (capped by a hop-count limit so a trigger chain can't loop back on itself).

## Directory Structure
```
pipeforge-app/
├── apps/
│   ├── web/              # React frontend application
│   ├── api/              # Express API server
│   └── worker/           # Background pipeline execution worker
├── packages/
│   ├── shared/           # Shared Mongoose schemas, types, crypto, mailer
│   ├── pipeline-engine/  # DAG execution, validation, and lineage — no HTTP/queue deps
│   └── config/           # Shared configs (eslint, tsconfig)
├── monitoring/           # Prometheus alert rules + a pre-provisioned Grafana dashboard
├── tests/e2e/            # Playwright end-to-end tests against the full running stack
├── docker-compose.yml        # Dev-only: MongoDB + Redis
└── docker-compose.prod.yml   # Full stack: web, api, worker, MongoDB, Redis
```

## Core Domain Models
- **User:** Authentication and identity (email verification, password reset, account lockout).
- **Project:** A workspace shared with members at owner/editor/viewer roles; owns Pipelines, Connections, and Files.
- **Pipeline:** Visual DAG (Nodes and Edges) plus its schedule, notification, webhook, and `triggerPipelineIds` (pipeline-to-pipeline chaining) configuration.
- **Connection:** A saved, encrypted, project-scoped credential (Postgres, MySQL, S3, generic API, or Kafka) referenced by a connector node's `connectionId` — never inlined into the pipeline definition.
- **Execution:** A single run of a pipeline, storing its node-by-node results, status, and (as `pipelineSnapshot`) the exact node/edge definition it ran — the basis for pipeline versioning and history.
- **File:** An uploaded dataset (CSV/JSON/Excel), scoped to a project and charged against its uploader's storage quota.
- **ActivityLog:** A per-project audit trail of member-visible actions (pipeline runs, connection changes, membership changes, etc).

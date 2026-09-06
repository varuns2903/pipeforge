# Architecture

pipeforge follows a layered architecture dividing responsibilities between the client UI, API layer, execution queue, background workers, and persistence.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, React Router, React Flow (XYFlow), TanStack Query, Zustand, Tailwind CSS.
- **Backend API:** Node.js, TypeScript, Express.js, Socket.IO.
- **Database:** MongoDB (via Mongoose).
- **Background Processing:** Redis, BullMQ.
- **Infrastructure:** Docker, Docker Compose.

## Components

### 1. Web Frontend (React)
Provides the visual pipeline editor, dashboard, project management, and execution monitoring. Uses REST APIs for CRUD operations and WebSockets (Socket.IO) for real-time status updates on running pipelines.

### 2. Backend API (Express)
Serves as the central coordination layer.
Follows a modular structure:
- `routes/` -> `controllers/` -> `services/` -> `repositories/`
Handles authentication, validations, database interactions, and queues background jobs when a pipeline execution is triggered.

### 3. Pipeline Execution Engine
A standalone module responsible for logic independent of HTTP requests:
- Builds a Directed Acyclic Graph (DAG) from pipeline definitions.
- Validates connections and configurations.
- Determines topological sort order for execution.
- Routes execution tasks through appropriate Node Executors.

### 4. Background Workers (BullMQ)
Listens to Redis queues for new pipeline execution jobs. Uses the Pipeline Execution Engine to process nodes sequentially (and eventually in parallel). Emits progress, logs, and completion states via WebSockets.

## Directory Structure
```
pipeforge-app/
├── apps/
│   ├── web/              # React frontend application
│   ├── api/              # Express API server
│   └── worker/           # Background pipeline execution worker
├── packages/
│   ├── shared/           # Shared types, dtos, constants
│   ├── pipeline-engine/  # DAG execution and validation engine
│   └── config/           # Shared configs (eslint, tsconfig)
├── infrastructure/       # Docker, CI/CD scripts
├── tests/                # E2E and global integration tests
└── docker-compose.yml    # Development setup for Mongo/Redis
```

## Core Domain Models
- **User:** Authentication and identity.
- **Project:** Workspace containing pipelines.
- **Pipeline:** Visual DAG representation containing Nodes and Edges.
- **PipelineVersion:** Immutable snapshots of a Pipeline for consistent execution history.
- **PipelineExecution:** A single run of a PipelineVersion.
- **ExecutionNode:** Status and logs for a specific node in an execution.
- **Dataset:** Uploaded files or intermediate processing outputs.

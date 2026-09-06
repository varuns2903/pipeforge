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

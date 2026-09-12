# Changelog

All notable changes to this project are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-09-12

First tagged release. PipeForge started as a 12-phase MVP build and grew,
commit by commit, into the feature set below.

### Pipeline editor & UX
- Visual drag-and-drop pipeline editor (React Flow) with a live-validated DAG
- Undo/redo across canvas edits (connect, delete, drag, layout toggle)
- Starter pipeline templates (CSV Cleanup, Dedupe & Export, Filter & Aggregate Report)
- Inline per-node data preview — run just a node's ancestor subgraph and see its output without saving
- Column-level lineage view — trace any output column back through renames, joins, aggregates, and more to its source
- Column-name autocomplete in config fields, sourced from the pipeline's last run
- Error/warning badges rendered directly on broken canvas nodes
- Soft-delete + restore UI for projects and pipelines (nothing is gone until you empty Trash)
- Route-based code-split frontend bundle

### Node types
- **Input:** CSV (configurable delimiter — CSV/TSV/semicolon/pipe), JSON, Excel (.xlsx)
- **Connectors:** Postgres, MySQL, S3, generic API, Kafka — all backed by saved, encrypted, project-scoped connections
- **Transform:** filter, branch (if/else), select/rename columns, sort, deduplicate, fill nulls, cast type, join, union
- **Aggregate:** group & aggregate (sum/avg/min/max/count-distinct), window functions (row_number/rank/dense_rank)
- **Output:** CSV, JSON, Excel export

### Execution & orchestration
- Asynchronous execution engine (BullMQ + Redis) with real-time progress over Socket.IO
- Pipeline-to-pipeline triggering — chain pipelines to run automatically on completion, with a hop-count limit against cycles
- Scheduled (cron) execution
- Pipeline versioning via immutable execution snapshots
- Retry for a past failed execution
- Per-user quotas (storage, concurrent executions) and a dataset-size cap to keep the worker memory-safe
- Data retention policy for old executions and files

### Collaboration & access control
- Project-based roles (owner/editor/viewer) with shared, project-scoped connections and files
- Per-project activity log
- JWT auth with email verification, password reset, a password policy, and account lockout
- httpOnly-cookie session storage (no token in localStorage)

### Notifications & integrations
- Email notification on pipeline completion/failure
- Outbound webhooks on pipeline completion/failure
- Prometheus alerts routed to Slack or email via Alertmanager

### Observability
- Prometheus metrics and OpenTelemetry tracing, with logs correlated to traces
- Pre-provisioned Grafana dashboard and alert rules

### Billing
- Stripe-backed plan tiers (test mode)

### API & platform
- OpenAPI spec served at `/api/docs` (Swagger UI) and `/api/openapi.json`
- Cursor-based pagination for execution history
- General API rate limiting (plus a stricter limit on auth and action-triggering endpoints)
- Playwright end-to-end tests covering the full user journey; unit/integration tests across API, worker, and pipeline engine
- Dockerfiles for web/api/worker, a production `docker-compose.prod.yml`, and CI

### Security
- Fixed pre-1.0 P0 issues: remote code execution, path traversal, IDOR, and an auth bypass

[1.0.0]: https://github.com/varuns2903/pipeforge/releases/tag/v1.0.0

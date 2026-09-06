# Contributing to pipeforge

## Git Workflow
- Use meaningful conventional commits.
  Examples: `feat(auth): add user registration`, `fix(worker): handle failed execution state`, `test(engine): add cycle detection tests`.
- Do not use meaningless commits like "update" or "fixed".
- Branching strategy: `main` for production, `feature/*` and `fix/*` for active development.

## Development Principles
1. **Separation of Concerns:** Keep routing, business logic, and data access separated. Do not place business logic in Express route handlers.
2. **Strong Typing:** Use TypeScript everywhere. Avoid `any`.
3. **No Hidden Secrets:** Never hardcode secrets. Use environment variables defined in `.env`.
4. **Validation First:** Validate all inputs at the edges (API routes, job inputs, file uploads) using Zod or similar.
5. **Robust Error Handling:** Do not expose stack traces to clients. Log errors properly and return safe API responses.
6. **No Fake Functionality:** Do not mock successful execution when real implementation is required.
7. **Security:** Prevent arbitrary code execution. Do not use `eval()` for user-provided expressions.

## Definition of Done
A task is considered complete when:
- The implementation is finished.
- TypeScript compilation and Linting pass.
- Unit/Integration tests are written and pass.
- Error handling and validation are implemented.
- UI gracefully handles loading, error, and empty states.
- Existing functionality is unbroken.

## Setting up locally
See the README for instructions on starting the Docker-compose environment (Mongo, Redis) and the web/api/worker apps.

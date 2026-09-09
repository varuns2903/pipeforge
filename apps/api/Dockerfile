# Build from the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/pipeline-engine/package.json packages/pipeline-engine/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY packages/pipeline-engine packages/pipeline-engine
COPY apps/api apps/api

RUN npm run build -w @pipeforge/shared
RUN npm run build -w @pipeforge/pipeline-engine
RUN npm run build -w @pipeforge/api
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/pipeline-engine/package.json packages/pipeline-engine/package.json
COPY --from=build /repo/packages/pipeline-engine/dist packages/pipeline-engine/dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]

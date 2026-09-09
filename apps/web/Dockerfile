# Build from the monorepo root: docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com .
FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/pipeline-engine/package.json packages/pipeline-engine/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @pipeforge/shared

# Vite inlines env vars into the bundle at build time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @pipeforge/web

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1

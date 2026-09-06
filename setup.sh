#!/bin/bash
mkdir -p apps/web apps/api apps/worker packages/shared packages/pipeline-engine packages/config infrastructure tests docs
npm init -y
npm pkg set private=true
npm pkg set workspaces.0="apps/*" workspaces.1="packages/*"
cat << 'DOCKER' > docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
DOCKER

cd packages/config
npm init -y
npm pkg set name="@pipeforge/config" version="1.0.0" main="index.js"
cd ../shared
npm init -y
npm pkg set name="@pipeforge/shared" version="1.0.0" main="index.js"
cd ../pipeline-engine
npm init -y
npm pkg set name="@pipeforge/pipeline-engine" version="1.0.0" main="index.js"

cd ../../apps/api
npm init -y
npm pkg set name="@pipeforge/api" version="1.0.0" main="index.js"
cd ../worker
npm init -y
npm pkg set name="@pipeforge/worker" version="1.0.0" main="index.js"
cd ../web
# Vite React TS setup
npm create vite@latest . -- --template react-ts
npm pkg set name="@pipeforge/web" version="1.0.0"

cd ../..

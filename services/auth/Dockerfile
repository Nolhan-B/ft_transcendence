# 1. Base stage: shared dependencies and toolchain
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copy workspace package manifests for cached layer installation
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/auth/package*.json ./services/auth/

# Install dependencies for auth service and shared package
RUN npm install --workspace=auth-service --workspace=shared

# Copy centralized Prisma schema and local configurations
COPY shared/prisma ./shared/prisma
COPY services/auth/prisma* ./services/auth/

# Generate Prisma Client targeting the shared schema
RUN npx --workspace=auth-service prisma generate --schema=/app/shared/prisma/schema.prisma

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

COPY shared ./shared
COPY services/auth ./services/auth

# Build shared library so dist/index.js is available at runtime
RUN npm --workspace=shared run build

WORKDIR /app/services/auth
COPY services/auth/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# 3. Builder stage (production build)
FROM base AS builder
COPY shared ./shared
COPY services/auth ./services/auth

# Build shared package first to produce distribution files and type definitions
WORKDIR /app/shared
RUN npm run build

# Build auth service and prune development dependencies
WORKDIR /app/services/auth
RUN npm run build
RUN npm prune --omit=dev

# 4. Production stage: minimal runtime footprint
FROM node:22-alpine AS prod
WORKDIR /app/services/auth
ENV NODE_ENV=production
RUN apk add --no-cache wget

# Copy runtime artifacts and production node_modules from builder
COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/shared /app/shared
COPY --chown=node:node --from=builder /app/services/auth/dist ./dist
COPY --chown=node:node --from=builder /app/services/auth/prisma* ./
COPY --chown=node:node --from=builder /app/services/auth/package*.json ./

USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
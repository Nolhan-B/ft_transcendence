# 1. Base stage: shared dependencies and toolchain
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/auth/package*.json ./services/auth/

RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=auth-service --workspace=shared

# Build shared package once (generates Prisma Client and compiles shared TS)
COPY shared ./shared
RUN cd shared && npm run build

# Copy service-specific Prisma configuration if present
COPY services/auth/prisma* ./services/auth/

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

# Copy auth source code last to preserve cache on shared build layer
COPY services/auth ./services/auth

WORKDIR /app/services/auth
COPY services/auth/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# 3. Builder stage (production build)
FROM base AS builder
COPY services/auth ./services/auth

# Build TypeScript via workspace
RUN npm run build --workspace=auth-service

# Purge devDependencies au niveau du monorepo
RUN npm prune --omit=dev --workspace=auth-service --workspace=shared

# 4. Production stage: minimal runtime footprint
FROM node:22-alpine AS prod
WORKDIR /app/services/auth
ENV NODE_ENV=production

RUN apk add --no-cache wget openssl netcat-openbsd

# Entrypoint
COPY services/auth/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --chown=node:node package*.json /app/
COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/shared/package*.json /app/shared/
COPY --chown=node:node --from=builder /app/shared/dist /app/shared/dist
COPY --chown=node:node --from=builder /app/services/auth/package*.json ./
COPY --chown=node:node --from=builder /app/services/auth/dist ./dist
COPY --chown=node:node --from=builder /app/services/auth/prisma* ./

USER node
EXPOSE 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
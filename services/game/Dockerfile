# 1. Base stage: shared dependencies and toolchain
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/game/package*.json ./services/game/

# Mount host npm cache to install dependencies via workspaces
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=game-service --workspace=shared

# Build shared package (generates Prisma Client and compiles shared TS)
COPY shared ./shared
RUN cd shared && npm run build

# Copy service-specific Prisma directory if present and generate client in base layer
COPY services/game/prisma* ./services/game/prisma/
RUN if [ -f ./services/game/prisma/schema.prisma ]; then \
      npx prisma generate --schema=./services/game/prisma/schema.prisma; \
    fi

# =========================================================
# 2. Development stage
# =========================================================
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

# Copy game source code last to preserve cache on shared and Prisma layers
COPY services/game ./services/game

WORKDIR /app/services/game
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# =========================================================
# 3. Builder stage: compile TypeScript and prune devDeps
# =========================================================
FROM base AS builder

# Copy full game source code (Prisma client is already cached in base)
COPY services/game ./services/game

# Compile TypeScript for game service (outputs to services/game/dist)
RUN npm run build --workspace=game-service

# Remove devDependencies (TypeScript, @types, build tools)
RUN npm prune --omit=dev --workspace=game-service --workspace=shared

# =========================================================
# 4. Production stage: minimal and secure runtime image
# =========================================================
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Minimal runtime system dependencies (openssl for Prisma, wget for healthcheck)
RUN apk add --no-cache wget openssl dumb-init

# Copy entrypoint script for startup migrations if needed
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Selective copy from builder owned by non-root node user
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package*.json ./shared/
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/shared/prisma ./shared/prisma
COPY --chown=node:node --from=builder /app/services/game/package*.json ./services/game/
COPY --chown=node:node --from=builder /app/services/game/dist ./services/game/dist

# Copy service-specific Prisma files if present at runtime
COPY --chown=node:node --from=builder /app/services/game/prisma* ./services/game/prisma/

# Run as restricted non-root user
USER node

WORKDIR /app/services/game
EXPOSE 3002

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
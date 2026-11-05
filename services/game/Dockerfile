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

COPY services/game/prisma* ./services/game/

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

# Copy game source code last to preserve cache on previous layers
COPY services/game ./services/game

WORKDIR /app/services/game
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
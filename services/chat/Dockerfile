# 1. Base stage: shared dependencies and toolchain
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/chat/package*.json ./services/chat/

# Mount host npm cache to avoid writing /root/.npm into image layer
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=chat-service --workspace=shared

# Build shared package (generates Prisma Client and compiles shared TS)
COPY shared ./shared
RUN --mount=type=cache,target=/root/.npm \
    cd shared && npm run build

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development

# Copy chat source code last to preserve cache on previous layers
COPY services/chat ./services/chat

WORKDIR /app/services/chat

EXPOSE 3003

CMD ["npm", "run", "dev"]
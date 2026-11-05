# 1. Base stage: shared dependencies and toolchain
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copy workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/user/package*.json ./services/user/

# Mount host npm cache and deduplicate dependencies via workspaces
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=user-service --workspace=shared

# Build shared package (generates Prisma Client and compiles shared TS)
COPY shared ./shared
RUN --mount=type=cache,target=/root/.npm \
    cd shared && npm run build

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development

# Copy user source code last to preserve cache on previous layers
COPY services/user ./services/user

WORKDIR /app/services/user

EXPOSE 3004

CMD ["npm", "run", "dev"]
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
RUN cd shared && npm run build

# 2. Development stage
FROM base AS dev
ENV NODE_ENV=development

# Copy user source code last to preserve cache on previous layers
COPY services/user ./services/user

WORKDIR /app/services/user
EXPOSE 3004
CMD ["npm", "run", "dev"]

# 3. Builder stage: compile TypeScript and prune dev dependencies
FROM base AS builder
COPY services/user ./services/user

WORKDIR /app
RUN npm run build --workspace=user-service
RUN npm prune --omit=dev --workspace=user-service --workspace=shared

# 4. Production stage: minimal runtime footprint
FROM node:22-alpine AS prod
WORKDIR /app/services/user
ENV NODE_ENV=production

RUN apk add --no-cache wget openssl

# Copy hoisted dependencies and compiled artifacts
COPY --chown=node:node package*.json /app/
COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/shared/package*.json /app/shared/
COPY --chown=node:node --from=builder /app/shared/dist /app/shared/dist
COPY --chown=node:node --from=builder /app/services/user/package*.json ./
COPY --chown=node:node --from=builder /app/services/user/dist ./dist

USER node
EXPOSE 3004

CMD ["node", "dist/server.js"]
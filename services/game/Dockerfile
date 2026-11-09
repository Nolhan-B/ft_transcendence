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

# =========================================================
# 2. Development stage (utilisé actuellement en local)
# =========================================================
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

COPY services/game ./services/game

WORKDIR /app/services/game
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# =========================================================
# 3. Builder stage: compile le service game et purge les devDeps
# =========================================================
FROM base AS builder

# Copie du code source complet de game
COPY services/game ./services/game

# Si game possède son propre schéma Prisma, génération du client
RUN if [ -f ./services/game/prisma/schema.prisma ]; then \
      npx prisma generate --schema=./services/game/prisma/schema.prisma; \
    fi

# Compilation TypeScript du service game (génère services/game/dist)
RUN npm run build --workspace=game-service

# Suppression des devDependencies (TypeScript, @types, outils de build)
RUN npm prune --omit=dev --workspace=game-service --workspace=shared

# =========================================================
# 4. Production stage: image finale minimale et sécurisée
# =========================================================
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Dépendances système minimales de runtime (openssl pour Prisma, wget pour le healthcheck)
RUN apk add --no-cache wget openssl dumb-init

# Copie de l'entrypoint si des migrations doivent tourner au démarrage
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copie sélective depuis le builder avec attribution à l'utilisateur non-root node
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/shared/package*.json ./shared/
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/services/game/package*.json ./services/game/
COPY --chown=node:node --from=builder /app/services/game/dist ./services/game/dist

# Si Prisma a besoin du dossier prisma au runtime (migrations/schéma)
COPY --chown=node:node --from=builder /app/services/game/prisma* ./services/game/

# Exécution sous utilisateur restreint
USER node

WORKDIR /app/services/game
EXPOSE 3002

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
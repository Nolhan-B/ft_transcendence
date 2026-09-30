# 1. Base commune
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

# Copie des manifests pour le cache npm monorepo
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/auth/package*.json ./services/auth/

# Installation ciblée pour le workspace auth + shared
RUN npm install --workspace=auth-service --workspace=shared

# On copie le dossier Prisma centralisé depuis shared ainsi que la config locale d'auth
COPY shared/prisma ./shared/prisma
COPY services/auth/prisma* ./services/auth/

# Génération Prisma ciblée sur le schéma centralisé de shared
RUN npx --workspace=auth-service prisma generate --schema=/app/shared/prisma/schema.prisma

# 2. Stage Développement
FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

COPY shared ./shared
COPY services/auth ./services/auth

WORKDIR /app/services/auth
COPY services/auth/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# 3. Stage Builder (Production)
FROM base AS builder
COPY shared ./shared
COPY services/auth ./services/auth

# Compilation de la lib partagée en premier (pour générer les types .d.ts)
WORKDIR /app/shared
RUN npm run build

# Compilation du service auth
WORKDIR /app/services/auth
RUN npm run build
RUN npm prune --omit=dev

# 4. Stage Production
FROM node:22-alpine AS prod
WORKDIR /app/services/auth
ENV NODE_ENV=production
RUN apk add --no-cache wget

# On récupère les modules compilés, les fichiers partagés et les binaires Prisma
COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/shared /app/shared
COPY --chown=node:node --from=builder /app/services/auth/dist ./dist
COPY --chown=node:node --from=builder /app/services/auth/prisma* ./
COPY --chown=node:node --from=builder /app/services/auth/package*.json ./

USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
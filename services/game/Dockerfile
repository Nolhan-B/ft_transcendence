FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY services/game/package*.json ./services/game/

RUN npm install --workspace=game-service --workspace=shared

COPY shared ./shared
RUN cd shared && npm run build

COPY shared/prisma ./shared/prisma
COPY services/game/prisma* ./services/game/

RUN npx --workspace=game-service prisma generate --schema=/app/shared/prisma/schema.prisma

FROM base AS dev
ENV NODE_ENV=development
RUN apk add --no-cache netcat-openbsd

COPY services/game ./services/game

WORKDIR /app/services/game
COPY services/game/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
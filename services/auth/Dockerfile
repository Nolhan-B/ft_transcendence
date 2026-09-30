FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY services/auth/package*.json ./
RUN npm install

COPY services/auth/prisma7.config.ts ./
COPY services/auth/ ./
COPY shared/prisma ./prisma
RUN npx prisma generate

COPY services/auth/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget

# 1. Dépendances
COPY services/user/package*.json ./
RUN npm install

COPY services/user/ ./

COPY shared/prisma/schema.prisma ./prisma/schema.prisma

RUN npx prisma generate

EXPOSE 3004
CMD ["npm", "run", "dev"]
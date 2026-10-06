FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget

# 1. Dépendances
COPY services/user/package*.json ./
RUN npm install

COPY services/user/ ./

COPY shared/prisma ./shared/prisma

RUN npx prisma generate

EXPOSE 3004
CMD ["npm", "run", "dev"]
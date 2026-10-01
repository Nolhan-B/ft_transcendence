FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY services/chat/package*.json ./
RUN npm install

COPY services/chat/ ./

COPY shared/prisma ./shared/prisma

RUN npx prisma generate

EXPOSE 3003

CMD ["npm", "run", "dev"]
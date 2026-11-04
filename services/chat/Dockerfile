FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
COPY shared/ ./shared/
COPY services/chat/package*.json ./services/chat/

RUN npm install --workspace=chat-service --workspace=shared

RUN npm --workspace=shared run build

COPY services/chat/ ./services/chat/

WORKDIR /app/services/chat

RUN npx prisma generate

EXPOSE 3003

CMD ["npm", "run", "dev"]
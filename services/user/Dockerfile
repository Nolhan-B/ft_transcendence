FROM node:20-alpine
WORKDIR /app

COPY services/user/package*.json ./
RUN npm install

COPY services/user/prisma7.config.ts ./
COPY services/user/ ./
COPY shared/prisma ./prisma
RUN npx prisma generate

EXPOSE 3004
CMD ["npm", "run", "dev"]
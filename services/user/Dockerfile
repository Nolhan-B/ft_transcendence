FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget

COPY shared/ ./shared/
RUN cd shared && npm install && npm run build

COPY services/user/package*.json ./
RUN npm install && ln -s /app/shared /app/node_modules/shared

# 3. Code source du service user
COPY services/user/ ./

# 4. Génération Prisma
RUN npx prisma generate

EXPOSE 3004
CMD ["npm", "run", "dev"]
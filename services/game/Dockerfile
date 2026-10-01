FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache wget

RUN npm install

COPY . .

EXPOSE 3002

CMD ["npm", "run", "dev"]
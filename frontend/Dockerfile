FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache wget


COPY package*.json ./
COPY shared/ ./shared/
COPY frontend/package*.json ./frontend/

RUN npm install

FROM base AS dev

WORKDIR /app/frontend
COPY frontend/ ./
EXPOSE 80
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

FROM base AS builder

RUN npm run build --workspace=shared --if-present

# On copie le reste des sources du frontend et on compile
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS prod

RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache wget

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY frontend/package*.json ./frontend/

# Install only dependencies required by frontend, shared, and root workspace
RUN npm install --workspace=frontend --workspace=shared --include-workspace-root

FROM base AS dev

# Copy shared source code for local development fallback
COPY shared/ ./shared/

WORKDIR /app/frontend
COPY frontend/ ./
EXPOSE 80
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

FROM base AS builder

# Copy shared source code and compile the shared library first
COPY shared/ ./shared/
RUN npm run build --workspace=shared --if-present

# Copy frontend source code and build the production bundle
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS prod

# Configure Nginx with SPA fallback routing
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
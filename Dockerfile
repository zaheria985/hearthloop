# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source (config.json is excluded via .dockerignore — it lives on a volume).
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    CONFIG_DIR=/config

# Live, writable settings persist here (mount this as a volume).
VOLUME ["/config"]

EXPOSE 3000

CMD ["node", "server.js"]

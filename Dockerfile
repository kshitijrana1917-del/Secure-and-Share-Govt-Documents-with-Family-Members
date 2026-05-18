FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Native build tools + curl for health checks
RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Source only (node_modules excluded via .dockerignore)
COPY . .

RUN npm rebuild sqlite3 --build-from-source \
    && mkdir -p uploads logs data \
    && chown -R node:node /usr/src/app

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV SKIP_EMAIL=true
ENV DATABASE_PATH=/usr/src/app/data/database.sqlite
ENV LOG_CONSOLE=true

USER node

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=6 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD [ "node", "server.js" ]

FROM node:18-bullseye-slim

WORKDIR /usr/src/app

# Native build tools + curl for health checks
RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

# Copy package files first
COPY package*.json ./

# Install dependencies with prebuilt sqlite3 binaries (much faster than --build-from-source)
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Create required directories
RUN mkdir -p uploads logs data public \
    && chown -R node:node /usr/src/app

# Create a default index.html if it doesn't exist
RUN if [ ! -f public/index.html ]; then \
      echo '<!DOCTYPE html><html><head><title>GovSecure Portal</title></head><body><h1>GovSecure Portal</h1><p>Backend server is running.</p></body></html>' > public/index.html; \
    fi

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_PATH=/usr/src/app/data/database.sqlite
ENV LOG_CONSOLE=true

USER node

EXPOSE 3000

# Extended health check with more retries and longer start period for database init
HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=10 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD [ "node", "server.js" ]

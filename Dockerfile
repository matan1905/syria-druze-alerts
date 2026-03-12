FROM oven/bun:1.1.34 as base

WORKDIR /app

# Install dependencies separately for better caching
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy application source
COPY server.ts ./server.ts
COPY public ./public

# Data directory for subscriptions (no .env file in prod)
ENV NODE_ENV=production
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000

# Persist only data (env, subscriptions, etc.)
VOLUME ["/data"]

CMD ["bun", "run", "server.ts"]

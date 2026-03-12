FROM oven/bun:1.1.34 as base

WORKDIR /app

# Install dependencies separately for better caching
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy application source
COPY server.ts ./server.ts
COPY public ./public


EXPOSE 3000

# Allow mounting the app directory for config/code overrides
VOLUME ["/app"]

CMD ["bun", "run", "server.ts"]

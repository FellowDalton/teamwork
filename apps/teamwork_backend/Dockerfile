FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Create non-root user with home directory (required by Claude Code CLI v2+)
RUN adduser --disabled-password --gecos "" --home /home/appuser appuser && \
    chown -R appuser:appuser /app /home/appuser
USER appuser

EXPOSE 8080
CMD ["bun", "run", "server-sdk.ts"]

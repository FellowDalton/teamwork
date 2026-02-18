FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Run as built-in bun user (non-root, required by Claude Code CLI v2+)
USER bun

EXPOSE 8080
CMD ["bun", "run", "server-sdk.ts"]

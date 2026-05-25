FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3001

# Container runs as root so vite + bun can write into the bind-mounted
# /app (owned by the host UID).
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["bun", "run", "dev:docker"]

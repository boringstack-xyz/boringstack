FROM node:24-slim

RUN npm install -g pnpm@11.1.2

WORKDIR /app

EXPOSE 3001

# Container runs as root so vite + pnpm can write into the bind-mounted
# /app (owned by the host UID).
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["pnpm", "run", "dev:docker"]

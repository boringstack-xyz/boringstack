FROM oven/bun:1.3.13-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

# Dev container runs as root: workdir is bind-mounted from the host and
# owned by the host UID, so a non-root container user can't write
# generated files (vite-style timestamp files in sibling repos, queued
# migrations, etc.). Production (Dockerfile.prod) runs as the non-root
# `app` user; that build doesn't bind-mount the source.
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["bun", "run", "dev"]

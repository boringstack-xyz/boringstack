FROM oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 7331

# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["bun", "--no-install", "./node_modules/.bin/vite"]

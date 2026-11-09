FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

EXPOSE 7331

# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["bun", "--no-install", "./node_modules/.bin/vite"]

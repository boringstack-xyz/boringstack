FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile \
  && cp -a node_modules /opt/node_modules

COPY scripts/docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

COPY . .

EXPOSE 3001

# Container runs as root so vite + bun can write into the bind-mounted
# /app (owned by the host UID).
# nosemgrep: dockerfile.security.missing-user.missing-user
ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
CMD ["bun", "--no-install", "./node_modules/.bin/vite"]

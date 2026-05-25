FROM oven/bun:1.3.13-alpine

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile \
  && cp -a node_modules /opt/node_modules

COPY scripts/docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

COPY . .

EXPOSE 3001

# Dev container runs as root: workdir is bind-mounted from the host and
# owned by the host UID, so a non-root container user can't write
# generated files. Production (Dockerfile.prod) runs as non-root.
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["bun", "--no-install", "./node_modules/.bin/vite"]

# Image build. Every configuration check runs here, never at container start:
# a bad SITE_URL, a missing CONTACT_EMAIL or a partial analytics setting fails
# `docker build` instead of producing a crash-looping container.
#
# Build from apps/site:
#   docker build --build-arg SITE_URL=https://example.com \
#     --build-arg APP_URL=https://app.example.com \
#     --build-arg CONTACT_EMAIL=hello@example.com -t boringstack-site .

FROM oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Development server for `docker compose --profile dev` (site-dev).
FROM deps AS dev
COPY . .
ENV HOST=0.0.0.0
EXPOSE 7333
CMD ["bun", "run", "dev"]

FROM deps AS build
COPY . .
ARG SITE_URL=""
ARG APP_URL=""
ARG CONTACT_EMAIL=""
ARG ANALYTICS_SCRIPT_URL=""
ARG ANALYTICS_WEBSITE_ID=""
ENV SITE_URL=$SITE_URL \
    APP_URL=$APP_URL \
    CONTACT_EMAIL=$CONTACT_EMAIL \
    ANALYTICS_SCRIPT_URL=$ANALYTICS_SCRIPT_URL \
    ANALYTICS_WEBSITE_ID=$ANALYTICS_WEBSITE_ID
RUN bun run build && bun run render:nginx

FROM nginx:1.31-alpine@sha256:892bb2152464f0c5d8972593a5f5afaf8054552580b699d95f8ff4af08c2d33d AS production
RUN addgroup -g 1001 -S app \
 && adduser -S app -u 1001 -G app
COPY --from=build /app/.build/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp \
 && nginx -t -c /etc/nginx/nginx.conf \
 && rm -rf /tmp/nginx
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1
# /tmp is the only writable path (tmpfs or emptyDir at runtime), so the temp
# directories are created when the container starts. The image's own entrypoint
# scripts are skipped: they try to write conf.d and are not needed here.
ENTRYPOINT []
CMD ["sh", "-c", "mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp && exec nginx -g 'daemon off;'"]

FROM oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e AS bun
FROM mcr.microsoft.com/playwright:v1.65.0-noble@sha256:9beb546099e11f52d62e505537914870e01a67e0e6b00ae41da4775324e73dbe
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /review
COPY apps/api/package.json apps/api/bun.lock apps/api/
COPY apps/ui/package.json apps/ui/bun.lock apps/ui/
RUN cd apps/api && bun install --frozen-lockfile --ignore-scripts && cd ../ui && bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN git init -q && git add . && git -c user.name=Verifier -c user.email=verifier@example.com commit -qm snapshot && git config --system safe.directory /review
USER 1000:1000
ENV HOME=/tmp
CMD ["sleep", "infinity"]

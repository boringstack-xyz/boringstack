FROM oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e AS bun
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579
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

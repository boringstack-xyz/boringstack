FROM oven/bun:1.4.3-debian@sha256:923bedb355f7746666659f71e724998159a5c8c54bd1cb1030e1975a0698415b AS bun
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf
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

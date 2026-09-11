FROM oven/bun:1.4.0-debian@sha256:5bb0f9be3a1a36a03e27c9a9dd894a3b1ad26657155c7df4dda771e17bf872ef AS bun
FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e
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

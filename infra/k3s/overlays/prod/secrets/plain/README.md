# Secrets backend: plain Secret from a gitignored .env

The simplest option — no controller, no Vault. Kustomize's `secretGenerator`
builds the `boringstack-secrets` Secret from a local `secret.env` that is
**gitignored** (never committed). Good for a private cluster you apply to
yourself; less ideal for pure GitOps since the secret values live outside git.

## Use it

1. `cp secret.env.example secret.env` and fill in real values (see the full key
   list in `infra/k3s/README.md`).
2. Create the GHCR pull secret out-of-band (it is not env-shaped):

   ```bash
   kubectl create secret docker-registry ghcr-registry-secret \
     --namespace boringstack-prod \
     --docker-server=ghcr.io \
     --docker-username=<github-user> \
     --docker-password=<github-pat-read:packages>
   ```

3. Point the overlay at `secrets/plain` instead of `secrets/vault`.

`secret.env` is matched by `.gitignore` in this directory — keep it that way.

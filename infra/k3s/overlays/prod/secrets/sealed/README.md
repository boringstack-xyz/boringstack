# Secrets backend: Sealed Secrets

GitOps-safe secrets without an external Vault. The Bitnami
[sealed-secrets](https://github.com/bitnami-labs/sealed-secrets) controller
decrypts committed `SealedSecret` manifests into real `Secret`s in-cluster.

## Use it

1. Install the controller on the cluster and the `kubeseal` CLI locally.
2. Author the two Secrets this stack needs, then seal them:

   ```bash
   # App env -> boringstack-secrets (one key per env var)
   kubectl create secret generic boringstack-secrets \
     --namespace boringstack-prod \
     --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
     --from-literal=MFA_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
     --from-literal=VALKEY_PASSWORD="$(openssl rand -base64 24)" \
     --from-literal=GLITCHTIP_SECRET_KEY="$(openssl rand -base64 50)" \
     # ...all other keys from infra/k3s/README.md... \
     --dry-run=client -o yaml \
     | kubeseal --format yaml > boringstack-secrets.sealedsecret.yaml

   # GHCR pull creds -> ghcr-registry-secret
   kubectl create secret docker-registry ghcr-registry-secret \
     --namespace boringstack-prod \
     --docker-server=ghcr.io \
     --docker-username=<github-user> \
     --docker-password=<github-pat-read:packages> \
     --dry-run=client -o yaml \
     | kubeseal --format yaml > ghcr-registry-secret.sealedsecret.yaml
   ```

3. Commit both `*.sealedsecret.yaml` files here, list them in
   `kustomization.yaml`, and point the overlay at `secrets/sealed` instead of
   `secrets/vault`.

SealedSecrets are safe to commit; only the controller's private key can
decrypt them.

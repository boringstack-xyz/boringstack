<p align="center">
  <a href="https://boringstack.xyz/topics/provisioning-with-tofu/">
    <img src="./assets/banner.png" alt="OpenTofu Template" />
  </a>
</p>

<p align="center">
  <a href="https://boringstack.xyz"><img src="https://img.shields.io/badge/boringstack.xyz-4ade80?style=for-the-badge&logo=safari&logoColor=4ade80&labelColor=090909" alt="boringstack.xyz"></a>
  <a href="https://boringstack.xyz/topics/provisioning-with-tofu/"><img src="https://img.shields.io/badge/Docs-4ade80?style=for-the-badge&logo=readthedocs&logoColor=4ade80&labelColor=090909" alt="Docs"></a>
  <a href="https://github.com/boringstack-xyz/boringstack/tree/main/infra/bootstrap"><img src="https://img.shields.io/badge/GitHub-4ade80?style=for-the-badge&logo=github&logoColor=4ade80&labelColor=090909" alt="GitHub"></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-e8e8ed?style=for-the-badge&labelColor=090909" alt="MIT"></a>
  <img src="https://img.shields.io/badge/OpenTofu-ffda77?style=for-the-badge&labelColor=090909" alt="OpenTofu">
  <img src="https://img.shields.io/badge/Hetzner-d50c2d?style=for-the-badge&logo=hetzner&logoColor=d50c2d&labelColor=090909" alt="Hetzner">
</p>

# infra/bootstrap

Part of [BoringStack](https://boringstack.xyz).

For documentation on how to run, configure, and extend the OpenTofu bootstrap, see the [OpenTofu provisioning docs](https://boringstack.xyz/topics/provisioning-with-tofu/).

## Remote state (optional)

State defaults to a local `terraform.tfstate`, which is fine for a quick spin-up but a single point of failure for anything long-lived — lose the file and you can no longer plan, reconcile, or safely destroy the stack. To move state to **Cloudflare R2** (S3-compatible, no egress fees, native locking — no DynamoDB):

1. Create an R2 bucket and an R2 API token with **Object Read & Write**.
2. `cp backend.hcl.example backend.hcl` and fill in the bucket name + account id (`backend.hcl` is gitignored).
3. Export the token as S3 credentials:
   ```sh
   export AWS_ACCESS_KEY_ID=<r2 access key id>
   export AWS_SECRET_ACCESS_KEY=<r2 secret access key>
   ```
4. Uncomment the `backend "s3"` block in `main.tf`, then migrate:
   ```sh
   tofu init -backend-config=backend.hcl -migrate-state
   ```

R2 uses the `s3` backend with AWS-specific preflight disabled; the block in `main.tf` is pre-filled with the right flags. Hetzner Object Storage or AWS S3 work the same way — only the `endpoints.s3` value (and the `skip_*`/`use_path_style` flags, for true AWS) differ.

## License

MIT

# Shared packages

Code used by more than one app lives here, one directory per package. This
README is the only file at this level; every directory with a `package.json` is
a package.

- Guide, package shape and required scripts: [apps/ui/docs/agents/shared-packages.md](../apps/ui/docs/agents/shared-packages.md)
- Apps reach this directory as `../../packages` from `apps/<app>`. Compose mounts
  it into dev containers and the prod image builds take it as the `packages`
  named build context, so an import that works locally works in images too.

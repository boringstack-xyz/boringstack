# Candidate execution boundary

This controller protects the local machine while evaluating a supplied Projects
implementation. The trusted inputs are the reviewing checkout, its pinned images,
locked dependencies, Docker installation and operating-system kernel. Candidate
source and appended migration artifacts are untrusted inputs.

## Authority and data flow

| Boundary          | Allowed authority                                                         | Excluded authority                                                              |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Image preparation | Reviewer-selected source and locked dependency installation               | Candidate scripts, dependencies, Dockerfiles and configuration                  |
| Source intake     | Regular files in the declared API/UI surface and append-only migrations   | Symlinks, removed/rewritten migration history, arbitrary files                  |
| Candidate runtime | Non-root process, bounded temporary filesystem, private loopback services | Host mounts, Docker socket, host credentials, outbound network, published ports |
| Result collection | Bounded stdout/stderr and process completion                              | Candidate-provided test expectations                                            |
| Cleanup           | Containers and image tag named for this random run                        | Global Docker pruning or shared development services                            |

The candidate runner has a read-only root, all Linux capabilities dropped,
`no-new-privileges`, process/memory/CPU limits and bounded tmpfs. Postgres and
Valkey run in separate containers sharing only its network namespace. No external
network is attached, so candidate application code can reach its disposable
services but cannot use the host network or internet. Both services use fresh
credentials. Input is streamed into tmpfs; no host source directory is mounted.

The live integration test checks the effective UID, capability and privilege
settings, absence of host paths and the Docker socket, absence of external routes,
and denial of writes to the reviewing source. A positive control must still
complete API, UI and browser acceptance inside the same restrictions. A policy
unit test checks that host mounts and privileged execution cannot enter the launch
arguments unnoticed.

## Limits

Container isolation shares Docker's kernel and is not a separate virtual-machine
boundary on native Linux. Keep Docker and its host patched. Resource limits bound
this run, not every workload on the machine. A forcibly killed controller or an
unavailable Docker daemon can require manual cleanup of the reported run names.

Application code executes inside test processes and can influence their behavior.
This boundary protects the host; it does not prove assertions are immune to
malicious same-process code. Review code and evidence independently. Deterministic
mutation tests validate the judge separately from arbitrary candidate runs.

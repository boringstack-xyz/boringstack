import { execFileSync } from "node:child_process";

/** Stream reviewed files into tmpfs through exec; no bind mount exposes a host directory. */
export function sendInput(name: string, directory: string): void {
  execFileSync("docker", ["exec", name, "mkdir", "-p", "/tmp/input"], {
    timeout: 30_000,
  });
  const archive = execFileSync(
    "tar",
    ["--format=ustar", "-C", directory, "-cf", "-", "."],
    {
      timeout: 30_000,
      maxBuffer: 40 * 1024 * 1024,
    }
  );

  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "tar",
      "--no-same-owner",
      "-xf",
      "-",
      "-C",
      "/tmp/input",
    ],
    {
      input: archive,
      timeout: 30_000,
    }
  );
}

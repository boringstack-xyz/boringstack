/** Candidate code receives a private network namespace and no host mounts or inherited environment. */
export function runnerArguments(name: string, image: string): string[] {
  return [
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "1000:1000",
    "--pids-limit",
    "512",
    "--memory",
    "8g",
    "--cpus",
    "4",
    "--tmpfs",
    "/tmp:rw,exec,nosuid,nodev,size=4g,mode=1777",
    "--shm-size",
    "256m",
    image,
  ];
}

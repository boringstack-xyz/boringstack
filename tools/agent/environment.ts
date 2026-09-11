/** Only host executable locations and the explicit verification switches are read. */
export function hostEnvironment(): Record<string, string | undefined> {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
  };
}

export function openApiUrl(): string {
  const configured = process.env.OPENAPI_URL;

  return configured === undefined || configured === ""
    ? "http://localhost:7330/swagger/json"
    : configured;
}

export function dockerTestsEnabled(): boolean {
  return process.env.AGENT_DOCKER_TESTS === "true";
}

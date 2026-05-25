import { SENSITIVE_QUERY_PARAM_PARTS } from "./request-logger.constants";

export const redactSensitiveInfo = (url: string): string => {
  if (url === "") {
    return url;
  }

  try {
    const urlObj = new URL(url);

    for (const key of urlObj.searchParams.keys()) {
      const lower = key.toLowerCase();
      const isSensitive = SENSITIVE_QUERY_PARAM_PARTS.some((part) =>
        lower.includes(part)
      );

      if (isSensitive) {
        urlObj.searchParams.set(key, "[REDACTED]");
      }
    }

    return urlObj.toString();
  } catch {
    return url;
  }
};

import { ApiErrors } from "../../lib/errors";

/**
 * Destination validation for Web Push registrations.
 *
 * The delivery worker builds an outbound HTTPS POST to whatever endpoint is
 * stored, so an unvalidated endpoint makes registration a server-side
 * request forgery primitive against anything the API can reach: cloud
 * metadata on 169.254.169.254, services on loopback, hosts inside the VPC.
 * A length-bounded string is not validation.
 *
 * Enforced here rather than in the TypeBox schema because a real deployment
 * will want DNS resolution and an egress policy, and neither is available
 * to a synchronous schema validator. At the service boundary every caller
 * gets it, and the rule can grow asynchronous parts without moving.
 */

/** Only these hosts may be registered. Extend per deployment. */
const ALLOWED_HOST_SUFFIXES: readonly string[] = [
  "push.services.mozilla.com",
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
  "web.push.apple.com",
];

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u;

const isPrivateIpv4 = (host: string): boolean => {
  const match = IPV4.exec(host);

  if (match === null) {
    return false;
  }

  const [first, second] = match
    .slice(1)
    .map((part) => Number.parseInt(part, 10));

  if (first === undefined || second === undefined) {
    return false;
  }

  /*
   * Table-driven rather than a chain of `||`, so each range is legible as
   * the RFC block it stands for and adding one does not deepen the branch.
   */
  const PRIVATE_BLOCKS: readonly [number, number, number][] = [
    [0, 0, 255], //   0.0.0.0/8      this network
    [10, 0, 255], //  10.0.0.0/8     private
    [127, 0, 255], // 127.0.0.0/8    loopback
    [100, 64, 127], // 100.64.0.0/10 carrier-grade NAT
    [169, 254, 254], // 169.254.0.0/16 link-local (cloud metadata)
    [172, 16, 31], //  172.16.0.0/12 private
    [192, 168, 168], // 192.168.0.0/16 private
  ];

  if (first >= 224) {
    return true;
  }

  return PRIVATE_BLOCKS.some(
    ([net, low, high]) => first === net && second >= low && second <= high
  );
};

/*
 * `URL` keeps the brackets on an IPv6 hostname. Loopback, link-local (fe80::)
 * and unique-local (fc00::/7, i.e. fc.. and fd..) are all unreachable from
 * the public internet and therefore never a real push service.
 */
const isPrivateIpv6 = (host: string): boolean => {
  if (!host.startsWith("[") || !host.endsWith("]")) {
    return false;
  }

  const inner = host.slice(1, -1).toLowerCase();

  return (
    inner === "::1" ||
    inner === "::" ||
    inner.startsWith("fe80:") ||
    inner.startsWith("fc") ||
    inner.startsWith("fd")
  );
};

const isLoopbackName = (host: string): boolean => {
  const lower = host.toLowerCase();

  return lower === "localhost" || lower.endsWith(".localhost");
};

const isAllowedHost = (host: string): boolean =>
  ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );

/**
 * Throws unless `endpoint` is an HTTPS URL on a known push service.
 *
 * An allowlist, not a denylist. A denylist of private ranges loses to DNS:
 * a public name that resolves to 127.0.0.1 passes every textual check, so
 * the ranges below are a second line, not the boundary.
 */
export const assertAllowedPushEndpoint = (endpoint: string): void => {
  let parsed: URL;

  try {
    parsed = new URL(endpoint);
  } catch {
    throw ApiErrors.validation(
      "Push endpoint must be an absolute URL",
      "endpoint"
    );
  }

  if (parsed.protocol !== "https:") {
    throw ApiErrors.validation("Push endpoint must use https", "endpoint");
  }

  const host = parsed.hostname;

  if (isLoopbackName(host) || isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw ApiErrors.validation(
      "Push endpoint must not target a private address",
      "endpoint"
    );
  }

  if (!isAllowedHost(host)) {
    throw ApiErrors.validation(
      "Push endpoint host is not a recognised push service",
      "endpoint"
    );
  }
};

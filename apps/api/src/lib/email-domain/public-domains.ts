/**
 * Hand-curated allowlist of public / consumer email domains. When
 * `ACCOUNT_DOMAIN_CLAIMING=true`, signups from these domains never
 * claim or join an existing claimed account — they always get a fresh
 * personal account, because no one company owns `gmail.com`.
 *
 * Keep the list short. The cost of a false negative (corporate domain
 * miscategorized as public) is "the company gets multiple parallel
 * accounts" — recoverable. The cost of a false positive (consumer
 * domain miscategorized as corporate) is "Gmail users all funnel into
 * one giant claimed account" — much worse.
 *
 * Operators forking the template can extend this list, but the
 * standard set covers ~98% of real-world consumer signups.
 */
export const PUBLIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "fastmail.com",
  "fastmail.fm",
  "tutanota.com",
  "tutamail.com",
  "tuta.io",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "gmx.at",
  "gmx.ch",
  "mail.com",
  "mail.ru",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "rediffmail.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "bellsouth.net",
  "earthlink.net",
  "mailinator.com",
  "guerrillamail.com",
  "dispostable.com",
  "10minutemail.com",
  "trashmail.com",
]);

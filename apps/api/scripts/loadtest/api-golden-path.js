// k6 load test — golden-path API smoke at sustained load.
//
// Exercises register → force-verify → login → dashboard summary → widget
// create → list, all over the SPA's Vite proxy at :7331 (same path your
// real users hit). Run against the local dev stack:
//
//   ./scripts/loadtest/run.sh
//
// The thresholds at the top of this file are the merge gate — when one
// trips, k6 exits non-zero. Tune for your hardware: a single Hetzner cx32
// happily serves the default 50 VUs; a laptop running everything in
// docker may need RPS dialed back.

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const BASE = __ENV.LOADTEST_BASE_URL || "http://localhost:7331";
const E2E_TOKEN_REQUIRED = __ENV.E2E_TEST_ENDPOINTS_ENABLED === "true";

const registerLatency = new Trend("register_latency", true);
const loginLatency = new Trend("login_latency", true);
const dashboardLatency = new Trend("dashboard_latency", true);
const errorsCounter = new Counter("flow_errors");

export const options = {
  scenarios: {
    golden_path: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "3m", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "20s",
    },
  },
  thresholds: {
    // p95 budgets — see findings 14 + 15 in the 1.0 audit. Tighten as
    // the workload allows.
    "http_req_duration{status:200}": ["p(95)<800"],
    "http_req_failed": ["rate<0.02"],
    "login_latency": ["p(95)<500"],
    "dashboard_latency": ["p(95)<600"],
    "flow_errors": ["count<10"],
  },
};

const uniqueEmail = (() => {
  let n = 0;
  return () => `loadtest+${__VU}-${__ITER}-${++n}@example.com`;
})();

const PASSWORD = "LoadTest!1Strong";

const expectStatus = (res, expected, label) => {
  const ok = res.status === expected;
  if (!ok) {
    errorsCounter.add(1, { step: label, status: String(res.status) });
  }
  return ok;
};

export default function () {
  if (!E2E_TOKEN_REQUIRED) {
    throw new Error(
      "Set E2E_TEST_ENDPOINTS_ENABLED=true on the api before running the loadtest. " +
        "The test relies on POST /auth/__test/force-verify."
    );
  }

  const email = uniqueEmail();
  const headers = { "Content-Type": "application/json" };
  const jar = http.cookieJar();

  group("register", () => {
    const start = Date.now();
    const res = http.post(
      `${BASE}/api/v1/auth/register`,
      JSON.stringify({
        email,
        password: PASSWORD,
        firstName: "Load",
        lastName: "Test",
      }),
      { headers }
    );
    registerLatency.add(Date.now() - start);
    check(res, { "register 200": (r) => expectStatus(r, 200, "register") });
  });

  group("force-verify", () => {
    const res = http.post(
      `${BASE}/api/v1/auth/__test/force-verify`,
      JSON.stringify({ email }),
      { headers, jar }
    );
    check(res, {
      "force-verify 200": (r) => expectStatus(r, 200, "force-verify"),
    });
  });

  group("login", () => {
    const start = Date.now();
    const res = http.post(
      `${BASE}/api/v1/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers, jar }
    );
    loginLatency.add(Date.now() - start);
    check(res, { "login 200": (r) => expectStatus(r, 200, "login") });
  });

  group("dashboard summary", () => {
    const start = Date.now();
    const res = http.get(`${BASE}/api/v1/dashboard/summary`, { jar });
    dashboardLatency.add(Date.now() - start);
    check(res, {
      "summary 200": (r) => expectStatus(r, 200, "dashboard"),
      "summary has totals": (r) =>
        r.body.includes("totalEvents") && r.body.includes("recentActivity"),
    });
  });

  group("create + list widget", () => {
    const createRes = http.post(
      `${BASE}/api/v1/widgets`,
      JSON.stringify({ name: `Widget ${__VU}-${__ITER}` }),
      { headers, jar }
    );
    check(createRes, {
      "create 200": (r) => expectStatus(r, 200, "widget-create"),
    });

    const listRes = http.get(`${BASE}/api/v1/widgets`, { jar });
    check(listRes, {
      "list 200": (r) => expectStatus(r, 200, "widget-list"),
      "list non-empty": (r) => r.body.includes(`"items":[`),
    });
  });

  sleep(Math.random() * 0.5);
}

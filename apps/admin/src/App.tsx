import { useState } from "react";

import { ActivityPage } from "./pages/ActivityPage";
import { OverviewPage } from "./pages/OverviewPage";

type Page = "overview" | "activity";

const PAGES: { id: Page; label: string }[] = [
  { id: "overview", label: "Queues" },
  { id: "activity", label: "Activity" },
];

/*
 * Two read-only pages. The dashboard has no login: it is reachable only on
 * the LAN, and the admin API acts as the operator resolved at boot.
 */
export const App = () => {
  const [page, setPage] = useState<Page>("overview");

  return (
    <div className="shell">
      <header className="shell-header">
        <strong>Operator dashboard</strong>
        <nav aria-label="Pages">
          {PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => {
                setPage(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main>{page === "overview" ? <OverviewPage /> : <ActivityPage />}</main>
    </div>
  );
};

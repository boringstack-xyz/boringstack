import { useState } from "react";

import { ActivityPage } from "./pages/ActivityPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { FeedPage } from "./pages/FeedPage";
import { OverviewPage } from "./pages/OverviewPage";

type Page = "overview" | "activity" | "feed" | "campaigns";

const PAGES: { id: Page; label: string }[] = [
  { id: "overview", label: "Queues" },
  { id: "activity", label: "Activity" },
  { id: "feed", label: "Feed" },
  { id: "campaigns", label: "Campaigns" },
];

const renderPage = (page: Page) => {
  switch (page) {
    case "overview":
      return <OverviewPage />;
    case "activity":
      return <ActivityPage />;
    case "feed":
      return <FeedPage />;
    case "campaigns":
      return <CampaignsPage />;
  }
};

/*
 * The dashboard has no login: it is reachable only on the LAN, and the admin
 * API acts as the operator resolved at boot. Writes (campaigns, the feed) go
 * through the same guard as reads.
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
      <main>{renderPage(page)}</main>
    </div>
  );
};

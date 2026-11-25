import { useEffect, useState } from "react";

import { adminGet } from "../lib/admin-api";
import {
  FeedActionResponseSchema,
  FeedListResponseSchema,
  SnoozeResponseSchema,
  type IFeedItem,
} from "../lib/admin-campaigns";
import { adminPost } from "../lib/admin-write";

const SNOOZE_HOURS = 24;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

/*
 * Items that need a look. Resolve hides an item until its count rises; snooze
 * hides it for a day. Both are recorded in the audit log by the admin API.
 */
export const FeedPage = () => {
  const [items, setItems] = useState<IFeedItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;

    adminGet("/feed", FeedListResponseSchema)
      .then((data) => {
        if (active) {
          setItems(data.items);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(errorText(error));
        }
      });

    return () => {
      active = false;
    };
  }, [version]);

  const act = (promise: Promise<unknown>, done: string) => {
    promise
      .then(() => {
        setNotice(done);
        setVersion((value) => value + 1);
      })
      .catch((error: unknown) => {
        setNotice(`Could not update the item: ${errorText(error)}`);
      });
  };

  const resolve = (key: string) => {
    act(
      adminPost(
        `/feed/${encodeURIComponent(key)}/resolve`,
        FeedActionResponseSchema
      ),
      "Item resolved."
    );
  };

  const snooze = (key: string) => {
    act(
      adminPost(
        `/feed/${encodeURIComponent(key)}/snooze`,
        SnoozeResponseSchema,
        {
          hours: SNOOZE_HOURS,
        }
      ),
      `Snoozed for ${String(SNOOZE_HOURS)} hours.`
    );
  };

  return (
    <section aria-labelledby="feed-heading">
      <h1 id="feed-heading">Action feed</h1>

      {notice === null ? null : <p role="status">{notice}</p>}
      {loadError === null ? null : (
        <p role="alert">Could not load the feed: {loadError}</p>
      )}
      {items === null && loadError === null ? (
        <p role="status">Loading the feed…</p>
      ) : null}

      {items !== null && items.length === 0 ? (
        <p>Nothing needs a look.</p>
      ) : null}

      {items === null || items.length === 0 ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Count</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>{item.title}</td>
                <td>{item.count}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      resolve(item.key);
                    }}
                  >
                    Resolve
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      snooze(item.key);
                    }}
                  >
                    Snooze {SNOOZE_HOURS}h
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

import { useEffect, useState, type SyntheticEvent } from "react";

import { adminGet } from "../lib/admin-api";
import {
  CampaignListResponseSchema,
  CampaignPreviewResponseSchema,
  CampaignResponseSchema,
  type ICampaign,
} from "../lib/admin-campaigns";
import { adminPost } from "../lib/admin-write";

type Preview = {
  campaign: ICampaign;
  recipientCount: number;
  truncated: boolean;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

/*
 * Compose, preview and send marketing email to the consented segment. A
 * campaign is sent once; the send button only appears after its preview. The
 * preview shows the segment size and the text, not the rendered HTML.
 */
export const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState<ICampaign[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;

    adminGet("/campaigns", CampaignListResponseSchema)
      .then((data) => {
        if (active) {
          setCampaigns(data.campaigns);
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

  const create = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    adminPost("/campaigns", CampaignResponseSchema, { subject, body })
      .then(() => {
        setSubject("");
        setBody("");
        setNotice("Draft saved.");
        setVersion((value) => value + 1);
      })
      .catch((error: unknown) => {
        setNotice(`Could not save the draft: ${errorText(error)}`);
      });
  };

  const showPreview = (id: string) => {
    adminGet(`/campaigns/${id}/preview`, CampaignPreviewResponseSchema)
      .then((data) => {
        setPreview(data);
        setNotice(null);
      })
      .catch((error: unknown) => {
        setNotice(`Could not preview: ${errorText(error)}`);
      });
  };

  const send = (id: string) => {
    adminPost(`/campaigns/${id}/send`, CampaignResponseSchema)
      .then((data) => {
        setPreview(null);
        setNotice(
          `Sent to ${String(data.campaign.recipientCount)} people, ${String(data.campaign.failedCount)} failed to queue.`
        );
        setVersion((value) => value + 1);
      })
      .catch((error: unknown) => {
        setNotice(`Could not send: ${errorText(error)}`);
      });
  };

  return (
    <section aria-labelledby="campaigns-heading">
      <h1 id="campaigns-heading">Campaigns</h1>

      <form onSubmit={create}>
        <label>
          Subject
          <input
            value={subject}
            maxLength={200}
            onChange={(event) => {
              setSubject(event.target.value);
            }}
            required
          />
        </label>
        <label>
          Body
          <textarea
            value={body}
            maxLength={20000}
            rows={8}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            required
          />
        </label>
        <button type="submit">Save draft</button>
      </form>

      {notice === null ? null : <p role="status">{notice}</p>}

      {preview === null ? null : (
        <aside aria-label="Campaign preview">
          <h2>Preview: {preview.campaign.subject}</h2>
          <p>
            Segment: {preview.recipientCount} people
            {preview.truncated ? " (capped; more are consented)" : ""}
          </p>
          <pre>{preview.campaign.body}</pre>
          <button
            type="button"
            onClick={() => {
              send(preview.campaign.id);
            }}
          >
            Send to {preview.recipientCount} people
          </button>
        </aside>
      )}

      {loadError === null ? null : (
        <p role="alert">Could not load campaigns: {loadError}</p>
      )}
      {campaigns === null && loadError === null ? (
        <p role="status">Loading campaigns…</p>
      ) : null}

      {campaigns === null ? null : (
        <table>
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">Status</th>
              <th scope="col">Recipients</th>
              <th scope="col">Sent</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>{campaign.subject}</td>
                <td>{campaign.status}</td>
                <td>{campaign.recipientCount}</td>
                <td>{campaign.sentAt ?? "-"}</td>
                <td>
                  {campaign.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => {
                        showPreview(campaign.id);
                      }}
                    >
                      Preview
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAnswerFeedback,
  useClaimFeedbackMoment
} from "./Feedback.mutations";

const apiPost = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  apiClient: { POST: apiPost, PUT: apiPut }
}));

vi.mock("@/lib/privacy/product-events.service", () => ({
  recordProductEvent: record
}));

const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("feedback mutations", () => {
  beforeEach(() => {
    apiPost.mockReset();
    apiPut.mockReset();
    record.mockReset();
  });

  it("reports true only when the server says the moment is new", async () => {
    apiPost.mockResolvedValueOnce({ data: { show: true } });
    const { result } = renderHook(() => useClaimFeedbackMoment(), { wrapper });

    let shown: boolean | undefined;

    await act(async () => {
      shown = await result.current.mutateAsync("onboarded");
    });

    expect(shown).toBe(true);
    expect(apiPost).toHaveBeenCalledWith("/api/v1/feedback/{moment}/show", {
      params: { path: { moment: "onboarded" } }
    });
  });

  it("saves an answer and records the feedback event", async () => {
    apiPut.mockResolvedValueOnce({ data: undefined });
    const { result } = renderHook(() => useAnswerFeedback(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        moment: "upgraded",
        answer: "Clearer pricing",
        dismissed: false
      });
    });

    expect(apiPut).toHaveBeenCalledWith("/api/v1/feedback/{moment}", {
      params: { path: { moment: "upgraded" } },
      body: { answer: "Clearer pricing", dismissed: false }
    });
    expect(record).toHaveBeenCalledWith("feedback_given");
  });

  it("does not record a dismissal as feedback given", async () => {
    apiPut.mockResolvedValueOnce({ data: undefined });
    const { result } = renderHook(() => useAnswerFeedback(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        moment: "onboarded",
        answer: "",
        dismissed: true
      });
    });

    expect(record).not.toHaveBeenCalled();
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFeedbackPrompt } from "./FeedbackPrompt.hooks";

const claim = vi.hoisted(() => vi.fn());
const answer = vi.hoisted(() => vi.fn());

vi.mock("../../Feedback.mutations", () => ({
  useClaimFeedbackMoment: () => ({ mutateAsync: claim }),
  useAnswerFeedback: () => ({ mutate: answer, isPending: false })
}));

describe("useFeedbackPrompt", () => {
  beforeEach(() => {
    claim.mockReset();
    answer.mockReset();
  });

  it("claims the moment once and opens only when the server says so", async () => {
    claim.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useFeedbackPrompt({ moment: "onboarded" })
    );

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true);
    });
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("an empty answer is saved as a dismissal", async () => {
    claim.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useFeedbackPrompt({ moment: "upgraded" })
    );

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true);
    });
    act(() => {
      result.current.onSubmit();
    });

    expect(answer).toHaveBeenCalledWith(
      { moment: "upgraded", answer: "", dismissed: true },
      expect.anything()
    );
    expect(result.current.isOpen).toBe(false);
  });

  it("a failed claim keeps the prompt closed", async () => {
    claim.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useFeedbackPrompt({ moment: "onboarded" })
    );

    await waitFor(() => {
      expect(claim).toHaveBeenCalled();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

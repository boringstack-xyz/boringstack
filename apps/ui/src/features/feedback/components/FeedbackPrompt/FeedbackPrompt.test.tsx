import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FEEDBACK_PROMPT_TEST_IDS } from "./FeedbackPrompt.constants";
import { FeedbackPrompt } from "./index";

const claimMock = vi.hoisted(() => vi.fn());
const answerMock = vi.hoisted(() => vi.fn());

vi.mock("../../Feedback.mutations", () => ({
  useClaimFeedbackMoment: () => ({ mutateAsync: claimMock }),
  useAnswerFeedback: () => ({
    mutate: answerMock,
    isPending: false
  })
}));

describe("FeedbackPrompt", () => {
  it("stays hidden when the server says the moment was already asked", async () => {
    claimMock.mockResolvedValueOnce(false);
    render(<FeedbackPrompt moment='onboarded' />);

    await waitFor(() => {
      expect(claimMock).toHaveBeenCalledWith("onboarded");
    });
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows once, sends the answer, and closes", async () => {
    claimMock.mockResolvedValueOnce(true);
    answerMock.mockClear();
    render(<FeedbackPrompt moment='onboarded' />);

    const box = await screen.findByRole("textbox");

    await userEvent.type(box, "Clear enough");
    await userEvent.click(screen.getByTestId(FEEDBACK_PROMPT_TEST_IDS.submit));

    expect(answerMock).toHaveBeenCalledWith(
      { moment: "onboarded", answer: "Clear enough", dismissed: false },
      expect.anything()
    );
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("dismissal sends no answer text", async () => {
    claimMock.mockResolvedValueOnce(true);
    answerMock.mockClear();
    render(<FeedbackPrompt moment='upgraded' />);

    await userEvent.click(
      await screen.findByTestId(FEEDBACK_PROMPT_TEST_IDS.dismiss)
    );

    expect(answerMock).toHaveBeenCalledWith(
      { moment: "upgraded", answer: "", dismissed: true },
      expect.anything()
    );
  });
});

import type { Meta, StoryObj } from "@storybook/react-vite";

import FeedbackPrompt from "./FeedbackPrompt";

/*
 * The prompt asks the API for its moment, so the story shows the component
 * mounted at a moment; with no API reachable the card stays hidden.
 */
const meta: Meta<typeof FeedbackPrompt> = {
  title: "features/feedback/FeedbackPrompt",
  component: FeedbackPrompt,
  args: { moment: "onboarded" }
};

export default meta;

type IStory = StoryObj<typeof FeedbackPrompt>;

export const Default: IStory = {};

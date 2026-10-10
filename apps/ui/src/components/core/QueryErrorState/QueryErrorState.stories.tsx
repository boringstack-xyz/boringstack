import type { Meta, StoryObj } from "@storybook/react-vite";

import { QueryErrorState } from "./QueryErrorState";

const meta: Meta<typeof QueryErrorState> = {
  title: "Core/QueryErrorState",
  component: QueryErrorState,
  args: {
    message: "Couldn't load things.",
    retryLabel: "Try again",
    onRetry: () => undefined
  }
};

export default meta;

type IStory = StoryObj<typeof QueryErrorState>;

export const Default: IStory = {};

export const Retrying: IStory = {
  args: { isRetrying: true }
};

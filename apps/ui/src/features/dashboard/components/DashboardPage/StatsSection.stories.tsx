import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatsSection } from "./StatsSection";

const meta: Meta<typeof StatsSection> = {
  title: "Features/Dashboard/StatsSection",
  component: StatsSection
};

export default meta;

type IStory = StoryObj<typeof StatsSection>;

const t = (key: string): string => key;

export const Default: IStory = {
  args: {
    isLoading: false,
    summary: { totalEvents: 1247 },
    t
  }
};

export const Loading: IStory = {
  args: {
    isLoading: true,
    summary: undefined,
    t
  }
};

export const Empty: IStory = {
  args: {
    isLoading: false,
    summary: undefined,
    t
  }
};

export const SingleStat: IStory = {
  name: "Populated (single stat)",
  args: {
    isLoading: false,
    summary: { totalEvents: 1247 },
    t
  }
};

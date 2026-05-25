import type { Meta, StoryObj } from "@storybook/react-vite";

import WebPushCard from "./WebPushCard";

const meta: Meta<typeof WebPushCard> = {
  title: "Features/Accounts/SettingsPage/WebPushCard",
  component: WebPushCard
};

export default meta;

type IStory = StoryObj<typeof WebPushCard>;

export const Default: IStory = {};

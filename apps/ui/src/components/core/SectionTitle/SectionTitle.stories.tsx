import type { Meta, StoryObj } from "@storybook/react-vite";

import SectionTitle from "./SectionTitle";

const meta: Meta<typeof SectionTitle> = {
  title: "Core/SectionTitle",
  component: SectionTitle,
  args: {
    title: "Notifications",
    description: "Choose how and when we reach you about account activity."
  }
};

export default meta;

type IStory = StoryObj<typeof SectionTitle>;

export const Default: IStory = {};

export const Subsection: IStory = {
  args: { level: 3, title: "Email digests" }
};

export const TitleOnly: IStory = {
  args: { description: undefined }
};

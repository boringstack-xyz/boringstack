import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";

import NotFoundPage from "./NotFoundPage";

const meta: Meta<typeof NotFoundPage> = {
  title: "Components/global/NotFoundPage",
  component: NotFoundPage,
  parameters: {
    layout: "fullscreen"
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    )
  ]
};

export default meta;

type IStory = StoryObj<typeof NotFoundPage>;

export const Default: IStory = {};

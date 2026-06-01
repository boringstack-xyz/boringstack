import { MemoryRouter } from "react-router-dom";

import type { Meta, StoryObj } from "@storybook/react-vite";

import AppSidebar from "./AppSidebar";

const meta: Meta<typeof AppSidebar> = {
  title: "Components/core/AppSidebar",
  component: AppSidebar,
  parameters: {
    layout: "fullscreen"
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/dashboard"]}>
        <div className='bg-background flex h-screen'>
          <Story />
        </div>
      </MemoryRouter>
    )
  ]
};

export default meta;

type IStory = StoryObj<typeof AppSidebar>;

export const Default: IStory = {};

export const OnNotifications: IStory = {
  name: "Active route: notifications",
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/notifications"]}>
        <div className='bg-background flex h-screen'>
          <Story />
        </div>
      </MemoryRouter>
    )
  ]
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import AppPage from "./AppPage";
import { AppPageHeaderProvider } from "./AppPageHeaderProvider";

const meta: Meta<typeof AppPage> = {
  title: "Components/core/AppPage",
  component: AppPage,
  decorators: [
    (Story) => (
      <AppPageHeaderProvider>
        <Story />
      </AppPageHeaderProvider>
    )
  ],
  parameters: {
    layout: "fullscreen"
  }
};

export default meta;

type IStory = StoryObj<typeof AppPage>;

export const Default: IStory = {
  args: {
    pageTitle: "Example page",
    title: "Example page",
    subtitle: "Page content starts below the AppShell title bar.",
    children: (
      <article className='border-border bg-background rounded-2xl border p-6'>
        <p className='text-muted-foreground text-sm'>Main content area</p>
      </article>
    )
  }
};

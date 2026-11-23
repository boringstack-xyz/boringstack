import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Spinner } from "./spinner";

const meta: Meta<typeof Spinner> = {
  title: "UI/Spinner",
  component: Spinner
};

export default meta;

type IStory = StoryObj<typeof Spinner>;

export const Default: IStory = { args: { label: "Saving" } };

export const InContext: IStory = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Button disabled>
        <Spinner className='text-current' /> Saving…
      </Button>
      <span className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Spinner /> Checking your connection
      </span>
    </div>
  )
};

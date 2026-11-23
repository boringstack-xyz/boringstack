import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "./collapsible";

const meta: Meta<typeof Collapsible> = {
  title: "UI/Collapsible",
  component: Collapsible,
  render: (args) => (
    <Collapsible {...args} className='w-96'>
      <CollapsibleTrigger className='text-sm font-medium underline'>
        Show advanced options
      </CollapsibleTrigger>
      <CollapsibleContent className='pt-2 text-sm'>
        Advanced options appear here.
      </CollapsibleContent>
    </Collapsible>
  )
};

export default meta;

type IStory = StoryObj<typeof Collapsible>;

export const Default: IStory = {};

export const Open: IStory = {
  args: { defaultOpen: true }
};

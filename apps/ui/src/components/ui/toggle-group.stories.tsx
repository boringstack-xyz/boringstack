import type { Meta, StoryObj } from "@storybook/react-vite";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta: Meta<typeof ToggleGroup> = {
  title: "UI/ToggleGroup",
  component: ToggleGroup,
  args: { type: "single", defaultValue: "list", "aria-label": "View" },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value='list' aria-label='List view'>
        List
      </ToggleGroupItem>
      <ToggleGroupItem value='grid' aria-label='Grid view'>
        Grid
      </ToggleGroupItem>
    </ToggleGroup>
  )
};

export default meta;

type IStory = StoryObj<typeof ToggleGroup>;

export const Default: IStory = {};

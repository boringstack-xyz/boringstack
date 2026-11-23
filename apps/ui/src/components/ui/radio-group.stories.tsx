import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "@/components/ui/label";

import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta: Meta<typeof RadioGroup> = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  args: { defaultValue: "monthly", "aria-label": "Billing period" },
  render: (args) => (
    <RadioGroup {...args}>
      {["monthly", "yearly"].map((value) => (
        <div key={value} className='flex items-center gap-2'>
          <RadioGroupItem value={value} id={`radio-${value}`} />
          <Label htmlFor={`radio-${value}`}>{value}</Label>
        </div>
      ))}
    </RadioGroup>
  )
};

export default meta;

type IStory = StoryObj<typeof RadioGroup>;

export const Default: IStory = {};

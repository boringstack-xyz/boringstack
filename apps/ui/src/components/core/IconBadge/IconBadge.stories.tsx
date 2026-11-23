import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, CircleAlert, Sparkles } from "lucide-react";

import IconBadge from "./IconBadge";

const meta: Meta<typeof IconBadge> = {
  title: "Core/IconBadge",
  component: IconBadge,
  args: { icon: Bell, tone: "outline" }
};

export default meta;

type IStory = StoryObj<typeof IconBadge>;

export const Default: IStory = {};

export const Tones: IStory = {
  render: () => (
    <div className='flex items-center gap-4'>
      <IconBadge icon={Sparkles} tone='outline' />
      <IconBadge icon={Bell} tone='soft' />
      <IconBadge icon={CircleAlert} tone='danger' />
    </div>
  )
};

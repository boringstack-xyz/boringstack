import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "./accordion";

const meta: Meta<typeof Accordion> = {
  title: "UI/Accordion",
  component: Accordion,
  args: { type: "single", collapsible: true, defaultValue: "item-1" },
  render: (args) => (
    <Accordion {...args} className='w-96'>
      <AccordionItem value='item-1'>
        <AccordionTrigger>Where is my data stored?</AccordionTrigger>
        <AccordionContent>In the region you chose at sign-up.</AccordionContent>
      </AccordionItem>
      <AccordionItem value='item-2'>
        <AccordionTrigger>Can I export it?</AccordionTrigger>
        <AccordionContent>Yes, as CSV or JSON from Settings.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
};

export default meta;

type IStory = StoryObj<typeof Accordion>;

export const Default: IStory = {};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  args: { variant: "default" },
  render: (args) => (
    <Alert {...args} className='w-96'>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        Your changes are saved on this device.
      </AlertDescription>
    </Alert>
  )
};

export default meta;

type IStory = StoryObj<typeof Alert>;

export const Default: IStory = {};

export const Destructive: IStory = {
  args: { variant: "destructive" }
};

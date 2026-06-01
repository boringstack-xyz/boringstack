import type { Meta, StoryObj } from "@storybook/react-vite";

import PreferenceRow from "./PreferenceRow";

const meta: Meta<typeof PreferenceRow> = {
  title: "Features/Notifications/PreferenceRow",
  component: PreferenceRow,
  decorators: [
    (Story) => (
      <table>
        <tbody>
          <Story />
        </tbody>
      </table>
    )
  ]
};

export default meta;

type IStory = StoryObj<typeof PreferenceRow>;

export const Default: IStory = {
  args: {
    row: {
      eventType: "comment.replied",
      channels: { "in-app": true, email: false }
    },
    channels: ["in-app", "email"],
    onToggle: () => undefined
  }
};

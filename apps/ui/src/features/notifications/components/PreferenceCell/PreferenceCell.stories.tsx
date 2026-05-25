import type { Meta, StoryObj } from "@storybook/react-vite";

import PreferenceCell from "./PreferenceCell";

const meta: Meta<typeof PreferenceCell> = {
  title: "Features/Notifications/PreferenceCell",
  component: PreferenceCell,
  decorators: [
    (Story) => (
      <table>
        <tbody>
          <tr>
            <Story />
          </tr>
        </tbody>
      </table>
    )
  ]
};

export default meta;

type IStory = StoryObj<typeof PreferenceCell>;

export const Default: IStory = {
  args: {
    eventType: "comment.replied",
    channel: "email",
    enabled: true,
    onToggle: () => undefined
  }
};

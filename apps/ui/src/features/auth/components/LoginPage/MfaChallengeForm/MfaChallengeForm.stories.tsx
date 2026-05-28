import type { Meta, StoryObj } from "@storybook/react-vite";

import MfaChallengeForm from "./MfaChallengeForm";

const meta: Meta<typeof MfaChallengeForm> = {
  title: "Features/Auth/LoginPage/MfaChallengeForm",
  component: MfaChallengeForm,
  parameters: { layout: "centered" }
};

export default meta;

type Story = StoryObj<typeof MfaChallengeForm>;

const noop = (): void => undefined;
const noopWithArg = (_value: string): void => undefined;

export const Default: Story = {
  args: {
    mode: "totp",
    code: "",
    error: null,
    isSubmitting: false,
    onCodeChange: noopWithArg,
    onSubmit: noop,
    onModeToggle: noop
  }
};

export const RecoveryMode: Story = {
  args: {
    ...Default.args,
    mode: "recovery"
  }
};

export const ErrorState: Story = {
  args: {
    ...Default.args,
    code: "123",
    error: "That code didn't work. Try again."
  }
};

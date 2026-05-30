import type { ReactElement } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";

import LoginCredentialsForm from "./LoginCredentialsForm";

const meta: Meta<typeof LoginCredentialsForm> = {
  title: "Features/Auth/LoginPage/LoginCredentialsForm",
  component: LoginCredentialsForm,
  parameters: { layout: "centered" },
  render: (args) => {
    const RenderForm = (): ReactElement => {
      const form = useForm<{ email: string; password: string }>({
        defaultValues: { email: "", password: "" }
      });

      return (
        <LoginCredentialsForm
          {...args}
          register={form.register}
          errors={form.formState.errors}
        />
      );
    };

    return <RenderForm />;
  }
};

export default meta;

type Story = StoryObj<typeof LoginCredentialsForm>;

const noop = (): void => undefined;

export const Default: Story = {
  args: {
    isSubmitting: false,
    submit: noop,
    oauthProviders: [],
    oauthButtons: [],
    oauthPending: null,
    pendingEmail: null,
    onResendVerification: noop,
    isResending: false
  }
};

export const PendingVerification: Story = {
  args: {
    ...Default.args,
    pendingEmail: "alice@example.com"
  }
};

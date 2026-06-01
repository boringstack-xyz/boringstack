import { useEffect } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { useCookieConsentStore } from "../CookieConsent.store";
import { CookieConsentBanner } from "./CookieConsentBanner";

const ResetThenRender = (): React.ReactElement => {
  useEffect(() => {
    useCookieConsentStore.getState().reset();
    localStorage.removeItem("bs.cookie-consent.v1");
  }, []);

  return <CookieConsentBanner />;
};

const meta: Meta<typeof CookieConsentBanner> = {
  title: "features/consent/CookieConsentBanner",
  component: CookieConsentBanner,
  render: () => <ResetThenRender />
};

export default meta;

type IStory = StoryObj<typeof CookieConsentBanner>;

export const Default: IStory = {};

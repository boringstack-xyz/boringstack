import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview, ReactRenderer } from "@storybook/react-vite";
import { HelmetProvider } from "react-helmet-async";

import { I18nProvider } from "../src/app/providers/I18nProvider";
import "../src/assets/css/tailwind.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      element: "#storybook-root",
      manual: false
    }
  },
  decorators: [
    withThemeByDataAttribute<ReactRenderer>({
      themes: {
        light: "light",
        dark: "dark"
      },
      defaultTheme: "light",
      attributeName: "data-theme",
      parentSelector: "html"
    }),
    (Story) => (
      <HelmetProvider>
        <I18nProvider>
          <div className='bg-background text-foreground min-h-screen p-6'>
            <Story />
          </div>
        </I18nProvider>
      </HelmetProvider>
    )
  ]
};

export default preview;

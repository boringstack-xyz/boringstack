import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview, ReactRenderer } from "@storybook/react-vite";
import { HelmetProvider } from "react-helmet-async";

import "../src/assets/css/tailwind.css";
import "../src/lib/i18n/config";

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
        <div className='bg-background text-foreground min-h-screen p-6'>
          <Story />
        </div>
      </HelmetProvider>
    )
  ]
};

export default preview;

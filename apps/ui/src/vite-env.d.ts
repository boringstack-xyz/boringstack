/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_PROXY_TARGET: string;
  readonly VITE_PUBLIC_URL: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_AUTH_NAMESPACE: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_LOCALES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

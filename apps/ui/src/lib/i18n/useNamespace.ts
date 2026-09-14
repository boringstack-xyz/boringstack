import { useTranslation } from "react-i18next";

/** Failed namespace downloads must reach the error boundary instead of rendering keys. */
export function useNamespace(namespace: string) {
  const translation = useTranslation(namespace);
  const { i18n, ready } = translation;

  if (
    ready &&
    !i18n.languages.some((language) =>
      i18n.hasResourceBundle(language, namespace)
    )
  ) {
    throw new Error(`Translation namespace unavailable: ${namespace}`);
  }

  return translation;
}

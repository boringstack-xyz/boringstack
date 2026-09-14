import type { BackendModule, ResourceKey } from "i18next";

const dictionaries = import.meta.glob<ResourceKey>(
  ["./locales/*/*.json", "!./locales/en/common.json"],
  {
    import: "default"
  }
);

/** Only dictionaries requested by i18next become network-loaded chunks. */
export const localeBackend: BackendModule = {
  type: "backend",
  init: () => undefined,
  read: (language, namespace, callback) => {
    const load = dictionaries[`./locales/${language}/${namespace}.json`];

    if (load === undefined) {
      callback(
        new Error(`Missing locale dictionary: ${language}/${namespace}`),
        false
      );

      return;
    }

    void load().then(
      (dictionary) => {
        callback(null, dictionary);
      },
      (error: unknown) => {
        callback(
          error instanceof Error
            ? error
            : new Error("Locale dictionary could not be loaded"),
          false
        );
      }
    );
  }
};

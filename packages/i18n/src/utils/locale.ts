import type { LocaleMessages } from "../types";

export function mergeMessages(target: LocaleMessages, source: LocaleMessages): LocaleMessages {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = mergeMessages((result[key] as LocaleMessages) || {}, value as LocaleMessages);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function extractKeys(messages: LocaleMessages, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(messages)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      keys.push(fullKey);
    } else {
      keys.push(...extractKeys(value as LocaleMessages, fullKey));
    }
  }

  return keys;
}

export function detectBrowserLocale(supportedLocales: string[]): string | undefined {
  if (typeof window === "undefined" || !window.navigator) {
    return undefined;
  }

  const browserLocales = window.navigator.languages || [window.navigator.language];

  for (const browserLocale of browserLocales) {
    const exactMatch = supportedLocales.find(
      (locale) => locale.toLowerCase() === browserLocale.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch;
    }

    const langCode = browserLocale.split("-")[0];
    const partialMatch = supportedLocales.find((locale) =>
      locale.toLowerCase().startsWith(langCode.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch;
    }
  }

  return undefined;
}

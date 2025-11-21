import type { LocaleMessages } from "../types";

interface I18nInstance {
  locale: string;
  messages: Record<string, LocaleMessages>;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: string) => void;
  getLocale: () => string;
  availableLocales: () => string[];
}

let currentLocale = "en";
let messages: Record<string, LocaleMessages> = {};
let listeners: Array<(locale: string) => void> = [];

export function createI18n(options: {
  locale?: string;
  messages: Record<string, LocaleMessages>;
}): I18nInstance {
  currentLocale = options.locale ?? "en";
  messages = options.messages;

  return {
    locale: currentLocale,
    messages,
    t,
    setLocale,
    getLocale,
    availableLocales,
  };
}

export function t(key: string, params?: Record<string, string | number>): string {
  const localeMessages = messages[currentLocale];
  if (!localeMessages) {
    return key;
  }

  let value = getNestedValue(localeMessages, key);
  if (value === undefined) {
    return key;
  }

  if (params) {
    value = interpolate(value, params);
  }

  return value;
}

export function setLocale(locale: string): void {
  if (messages[locale]) {
    currentLocale = locale;
    listeners.forEach((listener) => {
      listener(locale);
    });
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function availableLocales(): string[] {
  return Object.keys(messages);
}

export function onLocaleChange(callback: (locale: string) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getNestedValue(obj: LocaleMessages, path: string): string | undefined {
  const keys = path.split(".");
  let current: LocaleMessages | string = obj;

  for (const key of keys) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

import type { I18nContext, LocaleMessages, ResolvedI18nPluginOptions } from '../types';

export function createContext(options: ResolvedI18nPluginOptions, root: string): I18nContext {
  return {
    options,
    root,
    localeData: new Map<string, LocaleMessages>(),
    translationKeys: new Set<string>(),
  };
}

export function getNestedValue(obj: LocaleMessages, path: string): string | undefined {
  const keys = path.split('.');
  let current: LocaleMessages | string = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === 'string' ? current : undefined;
}

export function flattenMessages(messages: LocaleMessages, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(messages)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else {
      Object.assign(result, flattenMessages(value, fullKey));
    }
  }

  return result;
}

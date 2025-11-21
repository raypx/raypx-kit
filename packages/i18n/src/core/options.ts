import type { I18nPluginOptions, ResolvedI18nPluginOptions } from '../types';

const DEFAULT_OPTIONS: ResolvedI18nPluginOptions = {
  localesDir: 'locales',
  defaultLocale: 'en',
  locales: [],
  functionName: 't',
  include: ['**/*.{js,ts,jsx,tsx,vue}'],
  exclude: ['node_modules/**'],
  strictMode: false,
  generateTypes: true,
};

export function resolveOptions(options: I18nPluginOptions = {}): ResolvedI18nPluginOptions {
  const resolved: ResolvedI18nPluginOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    include: normalizeArray(options.include ?? DEFAULT_OPTIONS.include),
    exclude: normalizeArray(options.exclude ?? DEFAULT_OPTIONS.exclude),
  };

  return resolved;
}

function normalizeArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

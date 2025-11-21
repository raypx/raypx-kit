export interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}

export interface ResolvedLocale {
  code: string;
  messages: LocaleMessages;
}

export interface I18nPluginOptions {
  /**
   * Locales directory path
   * @default 'locales'
   */
  localesDir?: string;

  /**
   * Default locale
   * @default 'en'
   */
  defaultLocale?: string;

  /**
   * Supported locales
   * @default []
   */
  locales?: string[];

  /**
   * Translation function name in source code
   * @default 't'
   */
  functionName?: string;

  /**
   * Include file patterns
   * @default ['**\/*.{js,ts,jsx,tsx,vue}']
   */
  include?: string | string[];

  /**
   * Exclude file patterns
   * @default ['node_modules/**']
   */
  exclude?: string | string[];

  /**
   * Enable strict mode (throw error for missing keys)
   * @default false
   */
  strictMode?: boolean;

  /**
   * Generate TypeScript definitions for translation keys
   * @default true
   */
  generateTypes?: boolean;
}

export interface ResolvedI18nPluginOptions {
  localesDir: string;
  defaultLocale: string;
  locales: string[];
  functionName: string;
  include: string[];
  exclude: string[];
  strictMode: boolean;
  generateTypes: boolean;
}

export interface I18nContext {
  options: ResolvedI18nPluginOptions;
  root: string;
  localeData: Map<string, LocaleMessages>;
  translationKeys: Set<string>;
}

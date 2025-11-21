import type { Plugin } from 'vite';

export function i18nPlugin(): Plugin {
  return {
    name: 'i18n',
    enforce: 'pre',
  };
}

export default i18nPlugin;

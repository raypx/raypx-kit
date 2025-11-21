import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { createTransform } from '../transform';
import type { I18nContext, I18nPluginOptions, LocaleMessages } from '../types';
import { createContext } from './context';
import { resolveOptions } from './options';

const VIRTUAL_MODULE_ID = 'virtual:i18n';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export function i18nPlugin(userOptions: I18nPluginOptions = {}): Plugin {
  const options = resolveOptions(userOptions);
  let config: ResolvedConfig;
  let ctx = createContext(options, process.cwd());

  return {
    name: 'vite-plugin-i18n',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      ctx = createContext(options, config.root);
      loadLocales(ctx);
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return null;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return generateVirtualModule(ctx);
      }
      return null;
    },

    transform(code, id) {
      if (shouldTransform(id, options)) {
        return createTransform(code, id, ctx);
      }
      return null;
    },

    handleHotUpdate({ file, server }) {
      const localesPath = resolve(ctx.root, options.localesDir);
      if (file.startsWith(localesPath)) {
        loadLocales(ctx);
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (module) {
          server.moduleGraph.invalidateModule(module);
          return [module];
        }
      }
      return undefined;
    },
  };
}

function loadLocales(ctx: I18nContext): void {
  const localesPath = resolve(ctx.root, ctx.options.localesDir);

  if (!existsSync(localesPath)) {
    return;
  }

  const files = readdirSync(localesPath).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const locale = file.replace('.json', '');
    const filePath = resolve(localesPath, file);
    const content = readFileSync(filePath, 'utf-8');
    const messages = JSON.parse(content) as LocaleMessages;
    ctx.localeData.set(locale, messages);

    if (ctx.options.locales.length === 0 || ctx.options.locales.includes(locale)) {
      collectKeys(messages, ctx.translationKeys);
    }
  }
}

function collectKeys(messages: LocaleMessages, keys: Set<string>, prefix = ''): void {
  for (const [key, value] of Object.entries(messages)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.add(fullKey);
    } else {
      collectKeys(value, keys, fullKey);
    }
  }
}

function generateVirtualModule(ctx: I18nContext): string {
  const locales: Record<string, LocaleMessages> = {};
  for (const [locale, messages] of ctx.localeData) {
    locales[locale] = messages;
  }

  return `
export const locales = ${JSON.stringify(locales)};
export const defaultLocale = ${JSON.stringify(ctx.options.defaultLocale)};
export const availableLocales = ${JSON.stringify([...ctx.localeData.keys()])};
`;
}

function shouldTransform(id: string, options: ReturnType<typeof resolveOptions>): boolean {
  if (id.includes('node_modules')) {
    return false;
  }

  const includePatterns = options.include;
  const excludePatterns = options.exclude;

  const isIncluded = includePatterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(id);
  });

  const isExcluded = excludePatterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(id);
  });

  return isIncluded && !isExcluded;
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`${escaped}$`);
}

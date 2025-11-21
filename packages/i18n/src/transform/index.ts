import MagicString from 'magic-string';
import type { I18nContext } from '../types';

interface TransformResult {
  code: string;
  map: ReturnType<MagicString['generateMap']>;
}

export function createTransform(
  code: string,
  id: string,
  ctx: I18nContext
): TransformResult | null {
  const { functionName } = ctx.options;
  const pattern = new RegExp(`\\b${functionName}\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g');

  if (!pattern.test(code)) {
    return null;
  }

  const s = new MagicString(code);
  let hasChanges = false;

  pattern.lastIndex = 0;

  let match: RegExpExecArray | null = pattern.exec(code);
  while (match !== null) {
    const key = match[1];
    ctx.translationKeys.add(key);

    if (ctx.options.strictMode && !hasTranslationKey(ctx, key)) {
      throw new Error(`[vite-plugin-i18n] Missing translation key "${key}" in ${id}`);
    }

    hasChanges = true;
    match = pattern.exec(code);
  }

  if (!hasChanges) {
    return null;
  }

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  };
}

function hasTranslationKey(ctx: I18nContext, key: string): boolean {
  for (const messages of ctx.localeData.values()) {
    if (getNestedValue(messages, key) !== undefined) {
      return true;
    }
  }
  return false;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

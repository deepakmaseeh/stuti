import en from './en.json';

export type StringKey = keyof typeof en;

/**
 * UI string with `{name}` placeholders: t('search.noNumber', { book: 'DT' }).
 * When `n` is 1 and a `<key>.one` string exists, that singular form is used.
 */
export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  const one = `${key}.one`;
  const text = vars.n === 1 && one in en ? en[one as StringKey] : en[key];
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

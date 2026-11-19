import { INDIC_ANY } from './scripts';

const ZW = /[\u200B-\u200D\uFEFF]/g;

/** Normalise one token for matching. Indic: NFC + drop zero-width. Latin: fuzzy Indian-romanisation rules. */
export function normalizeToken(token: string): string {
  if (!token) return '';
  if (INDIC_ANY.test(token)) return token.normalize('NFC').replace(ZW, '');
  let s = token.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, ''); // strip diacritics (ā → a)
  s = s.replace(/[^a-z0-9]/g, '');
  s = s
    .replace(/sh/g, 's')
    .replace(/zh/g, 'l')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/w/g, 'v')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/aa/g, 'a')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/yi/g, 'ye')
    .replace(/([a-z])\1+/g, '$1'); // collapse doubles: labbhe → labe, pattaavu → patavu
  return s;
}

export function normalizeText(text: string): string[] {
  return text
    .split(/[\s\p{P}\p{S}]+/u)
    .map(normalizeToken)
    .filter(Boolean);
}

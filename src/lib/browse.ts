import type { Lang, Song } from './schema';

export type BrowseIndex = {
  letters: string[];
  topics: string[];
  byLetter: Record<string, string[]>;
  byTopic: Record<string, string[]>;
};

/** First grapheme cluster of native title (Indic conjuncts stay whole). */
export function firstGrapheme(text: string, lang: string): string {
  const t = text.trim();
  if (!t) return '';
  try {
    const seg = new Intl.Segmenter(lang, { granularity: 'grapheme' });
    return [...seg.segment(t)][0]?.segment ?? t[0] ?? '';
  } catch {
    return [...t][0] ?? '';
  }
}

/** Title-case a tag for display: "comfort" → "Comfort". */
export function titleCaseTopic(tag: string): string {
  const s = tag.trim();
  if (!s) return '';
  return s.replace(/\S+/g, (w) => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLocaleLowerCase());
}

/** Build browse index for one language from publishable songs. */
export function buildBrowseIndex(songs: Song[], lang: Lang): BrowseIndex {
  const byLetter: Record<string, string[]> = {};
  const byTopic: Record<string, string[]> = {};
  const collator = new Intl.Collator(lang);

  for (const s of songs) {
    const letter = firstGrapheme(s.title.native, lang);
    if (letter) (byLetter[letter] ??= []).push(s.id);
    for (const tag of s.tags) {
      const topic = titleCaseTopic(tag);
      if (topic) (byTopic[topic] ??= []).push(s.id);
    }
  }

  const letters = Object.keys(byLetter).sort(collator.compare);
  const topics = Object.keys(byTopic).sort((a, b) => a.localeCompare(b, 'en'));
  for (const k of letters) byLetter[k]!.sort((a, b) => a.localeCompare(b));
  for (const k of topics) byTopic[k]!.sort((a, b) => a.localeCompare(b));

  return { letters, topics, byLetter, byTopic };
}

import type { Lang, Song } from './schema';

export type BrowseIndex = {
  letters: string[];
  topics: string[];
  byLetter: Record<string, string[]>;
  byTopic: Record<string, string[]>;
};

/**
 * First base letter for Browse alphabet rows (क ख ग / A B C).
 * Skips matras and other combining marks so यीशु → य and प्रेम → प, not यी / प्रे.
 */
export function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const letter = t.match(/\p{L}/u)?.[0] ?? '';
  if (!letter) return '';
  // Stable A–Z buckets for English (and other Latin) titles.
  if (/^\p{Script=Latin}$/u.test(letter)) return letter.toLocaleUpperCase('en');
  return letter;
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
    const letter = firstGrapheme(s.title.native);
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

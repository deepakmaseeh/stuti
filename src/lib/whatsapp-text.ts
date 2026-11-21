import { formatSetDate } from './setlist';
import type { WorshipSet } from './sets';
import { songItems } from './sets';

/** Plain-text order of service for WhatsApp / share. */
export function worshipSetWhatsAppText(
  set: WorshipSet,
  opts: { titles?: Record<string, string>; url?: string } = {},
): string {
  const lines: string[] = [`🎵 ${set.title} · ${formatSetDate(set.date)}`];
  let n = 0;
  for (const it of set.items) {
    if (it.kind === 'heading') {
      lines.push(it.text.toUpperCase());
      continue;
    }
    n += 1;
    const title = opts.titles?.[it.songId] ?? it.songId;
    const book = it.book ? `${it.book} ` : '';
    const key = it.key ? ` (Key ${it.key})` : '';
    const verses =
      it.verses && it.verses.length ? ` (verses ${it.verses.map((i) => i + 1).join(', ')})` : '';
    lines.push(`${n}. ${book}${title}${key}${verses}`);
  }
  void songItems;
  if (opts.url) lines.push(`Open: ${opts.url}`);
  return lines.join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

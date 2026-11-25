import { formatSetDate } from './setlist';
import type { WorshipSet } from './sets';
import { songItems } from './sets';

/** WhatsApp / share body (MASTER §11.1). */
export function worshipSetWhatsAppText(
  set: WorshipSet,
  opts: { titles?: Record<string, string>; url?: string } = {},
): string {
  const when = formatSetDate(set.date);
  const time = set.time
    ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(`1970-01-01T${set.time}:00`),
      )
    : '';
  const led = set.leader ? ` · Led by ${set.leader}` : '';
  const head = [`*${set.title}*`, `${when}${time ? ` · ${time}` : ''}${led}`];

  const blocks: string[] = [...head, ''];
  let n = 0;
  let section = '';
  for (const it of set.items) {
    if (it.kind === 'heading') {
      section = it.text.toUpperCase();
      blocks.push(`*${section}*`);
      continue;
    }
    n += 1;
    const title = opts.titles?.[it.songId] ?? it.songId;
    const book = it.book ? `${it.book} ` : '';
    // Prefer badge-style "TLBC 12" when book is set; songItems keeps book on the row.
    const key = it.key ? ` (${it.key})` : '';
    blocks.push(`${n}. ${book.trim() ? `${book.trim()} – ` : ''}${title}${key}`);
  }
  void songItems;
  if (opts.url) {
    blocks.push('', `Lyrics: ${opts.url}`);
  }
  return blocks.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

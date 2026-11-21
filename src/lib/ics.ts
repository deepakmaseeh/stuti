import type { WorshipSet } from './sets';
import { songItems } from './sets';

/** Fold ICS lines to ≤75 octets (UTF-8 safe enough for our content). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < line.length) {
    let end = Math.min(line.length, start + 60);
    parts.push((start === 0 ? '' : ' ') + line.slice(start, end));
    start = end;
  }
  return parts.join('\r\n');
}

function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Build a VCALENDAR blob for a worship set (all-day if no time). */
export function buildIcs(set: WorshipSet, url?: string): string {
  const songs = songItems(set);
  const desc = [
    set.title,
    ...set.items.map((it, idx) => {
      if (it.kind === 'heading') return it.text.toUpperCase();
      const n = songs.indexOf(it) + 1;
      return `${n}. ${it.book ? it.book + ' · ' : ''}${it.songId}${it.key ? ` (Key ${it.key})` : ''}`;
    }),
    url ? `Open: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\\n');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = set.date.replace(/-/g, '');
  const dtStart = set.time
    ? `DTSTART:${day}T${set.time.replace(':', '')}00`
    : `DTSTART;VALUE=DATE:${day}`;
  const nextDay = (() => {
    const [y, m, d] = set.date.split('-').map(Number);
    const dt = new Date(y!, m! - 1, d! + 1);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  })();
  const dtEnd = set.time ? undefined : `DTEND;VALUE=DATE:${nextDay}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stuti//Worship Set//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:stuti-${set.id}@stuti`,
    `DTSTAMP:${stamp}`,
    dtStart,
    ...(dtEnd ? [dtEnd] : []),
    `SUMMARY:${esc(set.title)}`,
    `DESCRIPTION:${esc(desc.replace(/\\n/g, '\n')).replace(/\n/g, '\\n')}`,
    ...(url ? [`URL:${url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(set: WorshipSet, url?: string): void {
  const blob = new Blob([buildIcs(set, url)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Stuti-${set.date}-${set.title.replace(/[^\w\-]+/g, '_').slice(0, 40)}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

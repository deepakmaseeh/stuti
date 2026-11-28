import type { WorshipSet } from '../lib/sets';
import { serviceLabel } from '../lib/sets';
import {
  buildRunSheet,
  buildSequenceLabel,
  formatClock,
  type RunSheetSong,
} from '../lib/sets/runsheet';
import { site } from '../site.config';

export type OosCopy = 'lead' | 'cong' | 'mus';

type MetaRow = [string, string, string, string, string, string[]];

function longDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt);
  } catch {
    return iso;
  }
}

function copyClass(copy: OosCopy): string {
  if (copy === 'cong') return 'a4 cong';
  if (copy === 'mus') return 'a4 mus';
  return 'a4 lead-v';
}

function copyLabel(copy: OosCopy): string {
  if (copy === 'cong') return 'Congregation';
  if (copy === 'mus') return 'Musicians';
  return 'Leader';
}

export default function OrderOfService({
  set,
  meta,
  copy,
  showLyrics,
}: {
  set: WorshipSet;
  meta: Record<string, MetaRow> | null;
  copy: OosCopy;
  showLyrics: boolean;
}) {
  const songsById: Record<string, RunSheetSong> = {};
  for (const it of set.items) {
    if (it.kind !== 'song') continue;
    const row = meta?.[it.songId];
    const badge = row?.[3] ?? '';
    const badgeParts = badge.trim().split(/\s+/);
    const bookFromBadge = badgeParts[0];
    const noFromBadge = badgeParts[1] ?? '';
    const book = it.book || bookFromBadge || 'TLBC';
    songsById[it.songId] = {
      id: it.songId,
      title: { native: row?.[0] ?? it.songId, roman: row?.[1] ?? '', en: '' },
      numbers: [{ book, number: noFromBadge }],
      lang: row?.[2] ?? 'hi',
      sections: (it.verses ?? []).map((v) => ({
        type: 'verse' as const,
        label: `Verse ${v + 1}`,
        lines: [{ n: '…' }],
      })),
    };
  }

  const sheet = buildRunSheet(set, songsById);
  const showTime = !!set.time;
  const end =
    sheet.length > 0 ? formatClock(sheet[sheet.length - 1]!.end) : set.time ?? '';
  const books = new Set<string>();
  let songCount = 0;

  for (const sec of sheet) {
    for (const r of sec.rows) {
      if (r.k === 's') {
        songCount++;
        books.add(r.book);
      }
    }
  }

  return (
    <>
      <article id="oosSheet" class={copyClass(copy)}>
        <header class="oos-h">
          <div>
            <div class="ch">{site.name}</div>
            <h1>Order of Service</h1>
            <div class="sv">
              {set.title} · {copyLabel(copy)}
            </div>
          </div>
          <div class="qr" aria-hidden="true">
            <div>Scan to follow</div>
          </div>
        </header>

        <div class="oos-meta">
          <div>
            <i>Date</i>
            <b>{longDate(set.date)}</b>
          </div>
          {set.time ? (
            <div>
              <i>Time</i>
              <b>
                {set.time}
                {end && end !== set.time ? ` – ${end}` : ''}
              </b>
            </div>
          ) : null}
          {set.leader ? (
            <div>
              <i>Leader</i>
              <b>{set.leader}</b>
            </div>
          ) : null}
          {set.preacher ? (
            <div>
              <i>Preacher</i>
              <b>{set.preacher}</b>
            </div>
          ) : (
            <div>
              <i>Service</i>
              <b>{serviceLabel(set.service)}</b>
            </div>
          )}
        </div>

        <table class="oos">
          <thead>
            <tr>
              <th style="width:8mm">No.</th>
              {showTime ? <th class="c-time" style="width:14mm">Time</th> : null}
              <th style="width:22mm">Hymn</th>
              <th>Item / Title</th>
              <th class="c-key" style="width:12mm">
                Key
              </th>
              <th class="c-sing" style="width:28mm">
                Sing
              </th>
              <th class="c-by" style="width:22mm">
                Led by
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.flatMap((sec) => {
              const rows = [];
              if (sec.label) {
                rows.push(
                  <tr class="sec" key={`sec-${sec.label}-${sec.start}`}>
                    <td colSpan={showTime ? 7 : 6}>
                      {sec.label}
                      <span>
                        {formatClock(sec.start)}–{formatClock(sec.end)}
                      </span>
                    </td>
                  </tr>,
                );
              }
              for (const r of sec.rows) {
                if (r.k === 'i') {
                  rows.push(
                    <tr class="it" key={r.id}>
                      <td class="no">{r.n}</td>
                      {showTime ? <td class="tm c-time">{formatClock(r.at)}</td> : null}
                      <td class="hn">—</td>
                      <td class="ti">
                        <b>{r.title}</b>
                        {r.ref ? <em>{r.ref}</em> : null}
                      </td>
                      <td class="ky c-key" />
                      <td class="vs c-sing" />
                      <td class="by c-by">{r.by ?? ''}</td>
                    </tr>,
                  );
                  continue;
                }
                if (r.k === 'slide') {
                  rows.push(
                    <tr class="it" key={r.id}>
                      <td class="no">{r.n}</td>
                      {showTime ? <td class="tm c-time">{formatClock(r.at)}</td> : null}
                      <td class="hn">SLIDE</td>
                      <td class="ti">
                        <b>{r.title || (r.style === 'blank' ? 'Blank slide' : 'Slide')}</b>
                        {r.body ? <em>{r.body.slice(0, 80)}</em> : null}
                      </td>
                      <td class="ky c-key" />
                      <td class="vs c-sing" />
                      <td class="by c-by" />
                    </tr>,
                  );
                  continue;
                }
                const song = r.song;
                const num =
                  r.no != null
                    ? String(r.no)
                    : (song?.numbers[0]?.number ?? '');
                const hymn = `${r.book}${num ? ` ${num}` : ''}`;
                const seq = r.seq?.length ? buildSequenceLabel(r.seq) : 'All';
                rows.push(
                  <tr class="song" key={r.id}>
                    <td class="no">{r.n}</td>
                    {showTime ? <td class="tm c-time">{formatClock(r.at)}</td> : null}
                    <td class="hn">{hymn}</td>
                    <td class="ti">
                      <b>{song?.title.native ?? r.song}</b>
                      {song?.title.roman ? <small>{song.title.roman}</small> : null}
                      {r.note ? <em>{r.note}</em> : null}
                    </td>
                    <td class="ky c-key">{r.key ?? ''}</td>
                    <td class="vs c-sing">{seq}</td>
                    <td class="by c-by">{r.by ?? ''}</td>
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>

        <div class="oos-sum">
          <span>
            <b>{songCount}</b> songs
          </span>
          <span>
            Books: <b>{[...books].join(', ') || '—'}</b>
          </span>
        </div>
        {set.notes ? (
          <div class="oos-notes">
            <i>Notes</i>
            {set.notes}
          </div>
        ) : null}
        <footer class="oos-f">
          <span>Prepared with {site.name}</span>
          <span>
            {copyLabel(copy)} · {set.date}
          </span>
        </footer>
      </article>

      {showLyrics ? (
        <section id="lyrSheet" class="lyr-page">
          <h6>Lyrics</h6>
          <p class="muted">Open each song in Stuti for full lyrics. Selected verses print when offline packs include line text.</p>
        </section>
      ) : null}
    </>
  );
}

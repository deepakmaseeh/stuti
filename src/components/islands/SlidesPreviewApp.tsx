import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft, Download, MonitorPlay } from 'lucide-preact';
import type { BookBundle, BookBundleSong } from '../../lib/book-bundle';
import { downloadPptx } from '../../lib/pptx-export';
import { downloadSetPptx } from '../../lib/export/pptx';
import { loadMeta } from '../../lib/search';
import { getSet, hydrateSets, type WorshipSet } from '../../lib/sets';
import {
  buildRunSheet,
  buildSlides,
  parseRepeatMarker,
  type BuiltSlide,
  type RunSheetSong,
} from '../../lib/sets/runsheet';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';

function bundleToRunSong(id: string, song: BookBundleSong): RunSheetSong {
  return {
    id,
    title: { native: song.t[0], roman: song.t[1], en: song.t[2] },
    numbers: song.nums.map(([book, number]) => ({ book, number })),
    lang: song.lang,
    sections: song.sec.map((s) => ({
      type: s.type,
      label: s.label,
      lines: s.lines.map(([n, r, e]) => {
        const p = parseRepeatMarker(n);
        return { n: p.t, r, e, ...(p.x > 1 ? { x: p.x } : {}) };
      }),
    })),
  };
}

export default function SlidesPreviewApp() {
  const [slides, setSlides] = useState<BuiltSlide[] | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [backHref, setBackHref] = useState('/');
  const [presentHref, setPresentHref] = useState('/present/');
  const [mode, setMode] = useState<{ kind: 'song'; id: string; song: BookBundleSong } | { kind: 'set'; set: WorshipSet; songsById: Record<string, BookBundleSong> } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const songId = params.get('song');
    const setId = params.get('set');

    const load = async () => {
      try {
        const meta = await loadMeta();
        if (songId) {
          setBackHref(`/song/${encodeURIComponent(songId)}/`);
          setPresentHref(`/present/?song=${encodeURIComponent(songId)}`);
          const m = meta[songId];
          const [b, n] = (m?.[3] ?? '').trim().split(/\s+/);
          if (!b) {
            setError('Song not found.');
            return;
          }
          const res = await fetch(`/data/books/${encodeURIComponent(b)}.json`);
          if (!res.ok) throw new Error('fetch');
          const bundle = (await res.json()) as BookBundle;
          const s = bundle.songs[songId];
          if (!s) {
            setError('Song not found.');
            return;
          }
          const runSong = bundleToRunSong(songId, s);
          const tempSet: WorshipSet = {
            v: 2.1,
            id: songId,
            title: s.t[0],
            date: new Date().toISOString().slice(0, 10),
            service: 'other',
            rows: [{ k: 's', id: 's1', song: songId, book: b, no: Number(n) || undefined }],
            items: [],
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          const sheet = buildRunSheet(tempSet, { [songId]: runSong });
          setSlides(
            buildSlides(sheet, {
              set: tempSet,
              church: site.name,
              layers: { n: true, r: true, e: false },
            }),
          );
          setMode({ kind: 'song', id: songId, song: s });
          return;
        }

        if (setId) {
          hydrateSets();
          const set = getSet(setId);
          if (!set) {
            setError('Set not found on this device.');
            return;
          }
          setBackHref('/sets/');
          setPresentHref(`/present/?id=${encodeURIComponent(setId)}&i=0`);

          const booksNeeded = new Set<string>();
          const songIds: string[] = [];
          for (const r of set.rows ?? []) {
            if (r.k === 's') {
              songIds.push(r.song);
              booksNeeded.add(r.book);
              const [b] = (meta[r.song]?.[3] ?? '').trim().split(/\s+/);
              if (b) booksNeeded.add(b);
            }
          }
          const songsById: Record<string, BookBundleSong> = {};
          const runMap: Record<string, RunSheetSong> = {};
          await Promise.all(
            [...booksNeeded].map(async (b) => {
              const res = await fetch(`/data/books/${encodeURIComponent(b)}.json`);
              if (!res.ok) return;
              const bundle = (await res.json()) as BookBundle;
              for (const id of songIds) {
                if (bundle.songs[id]) {
                  songsById[id] = bundle.songs[id]!;
                  runMap[id] = bundleToRunSong(id, bundle.songs[id]!);
                }
              }
            }),
          );

          const sheet = buildRunSheet(set, runMap);
          setSlides(
            buildSlides(sheet, {
              set: {
                title: set.title,
                date: set.date,
                time: set.time,
                service: set.service,
                rows: set.rows,
                church: site.name,
              },
              church: site.name,
              layers: { n: true, r: true, e: false },
            }),
          );
          setMode({ kind: 'set', set, songsById });
          return;
        }

        setError('No song or set specified.');
      } catch {
        setError('Could not build slide preview.');
      }
    };

    void load();
  }, []);

  const handleDownload = async () => {
    if (!mode || downloading) return;
    setDownloading(true);
    try {
      if (mode.kind === 'song') {
        await downloadPptx([{ id: mode.id, song: mode.song, layers: { n: true, r: true, e: false } }]);
      } else {
        await downloadSetPptx(mode.set, mode.songsById, {
          layers: { n: true, r: true, e: false },
          onProgress: (msg) => showToast(msg),
        });
      }
    } catch {
      showToast('Could not generate PowerPoint');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div class="slides-preview">
      <div class="slides-preview__top">
        <a class="icon-btn" href={backHref} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <div class="slides-preview__head">
          <h1>Slides{slides ? ` · ${slides.length}` : ''}</h1>
          <p>Check every slide. Nothing downloads until you tap Download.</p>
        </div>
      </div>

      {error ? <p class="empty-hint">{error}</p> : null}
      {!error && !slides ? <p class="empty-hint">Building slide preview…</p> : null}

      <div class="slides-grid">
        {slides?.map((s, idx) => (
          <div class="slide-thumb" key={idx}>
            <div class="slide-thumb__meta">
              <span>#{idx + 1}</span>
              <span>
                {s.kind === 'lyrics'
                  ? `${s.book} ${s.no} · ${s.tag}`
                  : s.kind === 'note'
                    ? `${s.book} ${s.no} · NOTE`
                    : s.kind.toUpperCase()}
              </span>
            </div>
            <div class="slide-thumb__body">
              {s.kind === 'title' ? (
                <>
                  <strong>{s.title}</strong>
                  <small>{s.sub}</small>
                </>
              ) : null}
              {s.kind === 'section' ? <strong>{s.label}</strong> : null}
              {s.kind === 'item' ? (
                <>
                  <strong>{s.title}</strong>
                  {s.sub ? <small>{s.sub}</small> : null}
                </>
              ) : null}
              {s.kind === 'custom' ? (
                s.style === 'blank' ? (
                  <small>(Blank slide)</small>
                ) : (
                  <>
                    {s.title ? <strong>{s.title}</strong> : null}
                    {s.body ? <p>{s.body}</p> : null}
                  </>
                )
              ) : null}
              {s.kind === 'note' ? (
                <>
                  <small>{s.stanza}</small>
                  <strong>{s.text}</strong>
                </>
              ) : null}
              {s.kind === 'lyrics' ? (
                <>
                  {s.note ? <small class="slide-thumb__note">{s.note}</small> : null}
                  {s.lines.map((ln, li) => (
                    <div class="slide-thumb__line" key={li}>
                      {ln.t}
                      {ln.x > 1 ? ` ×${ln.x}` : ''}
                    </div>
                  ))}
                  {s.roman?.length ? (
                    <small class="slide-thumb__roman">{s.roman.join(' / ')}</small>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {slides?.length ? (
        <div class="slides-preview__bar">
          <a class="btn btn--ghost" href={presentHref}>
            <MonitorPlay size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Present</span>
          </a>
          <button
            type="button"
            class="btn btn--primary"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <Download size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{downloading ? 'Preparing…' : 'Download PowerPoint'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

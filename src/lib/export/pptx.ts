/**
 * Set PowerPoint export via buildSlides() (C32–C38).
 */
import type { BookBundleSong } from '../book-bundle';
import type { WorshipSet } from '../sets';
import {
  buildRunSheet,
  buildSlides,
  fitSize,
  parseRepeatMarker,
  slugTitle,
  type RunSheetSong,
} from '../sets/runsheet';
import { site } from '../../site.config';

function scriptFont(script: string): string {
  if (script === 'en') return 'Segoe UI';
  return 'Nirmala UI';
}

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
        const { t, x } = parseRepeatMarker(n);
        return { n: t, r, e, ...(x > 1 ? { x } : {}) };
      }),
    })),
  };
}

export async function downloadSetPptx(
  set: WorshipSet,
  songsById: Record<string, BookBundleSong | undefined>,
  opts: { layers?: { n?: boolean; r?: boolean; e?: boolean }; onProgress?: (msg: string) => void } = {},
): Promise<string> {
  opts.onProgress?.('Building slides…');
  const map: Record<string, RunSheetSong> = {};
  for (const [id, song] of Object.entries(songsById)) {
    if (song) map[id] = bundleToRunSong(id, song);
  }
  const sheet = buildRunSheet(set, map);
  const slides = buildSlides(sheet, {
    set: {
      title: set.title,
      date: set.date,
      time: set.time,
      service: set.service,
      rows: set.rows,
      church: site.name,
    },
    church: site.name,
    layers: opts.layers ?? { n: true, r: true, e: false },
  });

  opts.onProgress?.(`Building slides… ${slides.length}`);

  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineSlideMaster({
    title: 'STUTI',
    background: { color: '2E1418' },
    objects: [
      {
        text: {
          text: site.name,
          options: {
            x: 0.4,
            y: 7.0,
            w: 6,
            h: 0.3,
            fontFace: 'Segoe UI',
            fontSize: 11,
            color: 'C9B8A0',
          },
        },
      },
    ],
    slideNumber: { x: 12.4, y: 7.0, fontFace: 'Segoe UI', fontSize: 11, color: 'C9B8A0' },
  });

  let i = 0;
  for (const s of slides) {
    i++;
    const sl = pptx.addSlide({ masterName: 'STUTI' });
    if (s.kind === 'title') {
      sl.addText(s.title, {
        x: 0.6,
        y: 2.6,
        w: 12.1,
        h: 1.2,
        align: 'center',
        fontFace: 'Domine',
        fontSize: 44,
        bold: true,
        color: 'E9C46A',
      });
      sl.addText(s.sub, {
        x: 0.6,
        y: 3.9,
        w: 12.1,
        h: 0.6,
        align: 'center',
        fontFace: 'Segoe UI',
        fontSize: 20,
        color: 'F7F2EA',
      });
    } else if (s.kind === 'section') {
      sl.addText(s.label.toUpperCase(), {
        x: 0.6,
        y: 2.9,
        w: 12.1,
        h: 1,
        align: 'center',
        fontFace: 'Segoe UI',
        fontSize: 40,
        bold: true,
        charSpacing: 6,
        color: 'E9C46A',
      });
    } else if (s.kind === 'item') {
      sl.addText(s.type.toUpperCase(), {
        x: 0.6,
        y: 2.4,
        w: 12.1,
        h: 0.5,
        align: 'center',
        fontFace: 'Segoe UI',
        fontSize: 14,
        color: 'C9B8A0',
      });
      sl.addText(s.title, {
        x: 0.6,
        y: 3.0,
        w: 12.1,
        h: 0.8,
        align: 'center',
        fontFace: 'Segoe UI',
        fontSize: 36,
        bold: true,
        color: 'E9C46A',
      });
      if (s.sub) {
        sl.addText(s.sub, {
          x: 0.6,
          y: 4.0,
          w: 12.1,
          h: 0.5,
          align: 'center',
          fontFace: 'Segoe UI',
          fontSize: 20,
          color: 'F7F2EA',
        });
      }
    } else if (s.kind === 'custom') {
      if (s.style !== 'blank') {
        if (s.title) {
          sl.addText(s.title, {
            x: 0.8,
            y: s.body ? 1.8 : 2.9,
            w: 11.7,
            h: 0.9,
            align: 'center',
            fontFace: s.style === 'verse' ? 'Domine' : 'Segoe UI',
            fontSize: s.style === 'verse' ? 24 : 36,
            bold: true,
            color: 'E9C46A',
          });
        }
        if (s.body) {
          sl.addText(s.body, {
            x: 0.8,
            y: s.title ? 2.9 : 2.1,
            w: 11.7,
            h: 2.8,
            align: 'center',
            valign: 'middle',
            italic: s.style === 'verse',
            fontFace: 'Segoe UI',
            fontSize: 26,
            color: 'F7F2EA',
            lineSpacingMultiple: 1.3,
          });
        }
      }
    } else if (s.kind === 'note') {
      sl.addText(`${s.book} ${s.no} · ${s.stanza}`.trim(), {
        x: 0.6,
        y: 1.8,
        w: 12.1,
        h: 0.5,
        align: 'center',
        fontFace: 'Segoe UI',
        fontSize: 16,
        bold: true,
        color: 'E9C46A',
      });
      sl.addText(s.text, {
        x: 1.0,
        y: 2.6,
        w: 11.3,
        h: 2.4,
        align: 'center',
        valign: 'middle',
        fontFace: 'Segoe UI',
        fontSize: 28,
        color: 'F7F2EA',
      });
      sl.addNotes(`Next: ${s.next}`);
    } else if (s.kind === 'lyrics') {
      sl.addText(`${s.book} ${s.no}`.trim(), {
        x: 0.4,
        y: 0.25,
        w: 4,
        h: 0.4,
        fontFace: 'Segoe UI',
        fontSize: 14,
        bold: true,
        color: 'E9C46A',
      });
      sl.addText(s.tag, {
        x: 8.9,
        y: 0.25,
        w: 4,
        h: 0.4,
        align: 'right',
        fontFace: 'Segoe UI',
        fontSize: 14,
        bold: true,
        charSpacing: 3,
        color: 'E9C46A',
      });
      const size = fitSize(s.lines);
      sl.addText(
        s.lines.map((l) => ({
          text: l.t + (l.x > 1 ? `  ×${l.x}` : ''),
          options: { breakLine: true },
        })),
        {
          x: 0.6,
          y: 0.9,
          w: 12.1,
          h: 5.8,
          align: 'center',
          valign: 'middle',
          fontFace: scriptFont(s.script),
          fontSize: size,
          color: 'F7F2EA',
          lineSpacingMultiple: 1.25,
          // pptxgenjs supports fit on some versions
          fit: 'shrink',
        } as Record<string, unknown>,
      );
      if (s.roman?.length) {
        sl.addText(s.roman.join('\n'), {
          x: 0.6,
          y: 6.1,
          w: 12.1,
          h: 0.8,
          align: 'center',
          italic: true,
          fontFace: 'Segoe UI',
          fontSize: 18,
          color: 'E9D8A6',
        });
      }
      if (s.note) {
        sl.addText(s.note, {
          x: 0.8,
          y: 0.25,
          w: 11.7,
          h: 0.4,
          align: 'center',
          fontFace: 'Segoe UI',
          fontSize: 14,
          italic: true,
          color: 'E9C46A',
        });
      }
      sl.addNotes(`Next: ${s.next}`);
    }
    if (i % 5 === 0) opts.onProgress?.(`Building slides… ${i}/${slides.length}`);
  }

  const fileName = `Stuti_${set.date}_${slugTitle(set.title)}.pptx`;
  await pptx.writeFile({ fileName });
  opts.onProgress?.('Downloaded ✓');
  return fileName;
}

/** Re-export single-song helper path for SongToolbar. */
export { downloadPptx, expandSections } from '../pptx-export';

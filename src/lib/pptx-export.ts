import type { BookBundleSong } from './book-bundle';

export type PresentTheme = 'leather' | 'black' | 'white';

type SlideSec = { label: string; lines: [string, string, string][] };

/** Expand sections with chorus-after-each-verse, matching Present mode. */
export function expandSections(song: BookBundleSong): SlideSec[] {
  const chorus = song.sec.find((s) => s.type === 'chorus' || s.type === 'refrain');
  const out: SlideSec[] = [];
  for (const sec of song.sec) {
    const isChorus = sec.type === 'chorus' || sec.type === 'refrain';
    // With the flag, the chorus JSON block is the template only — inject after each verse
    // (do not also show it as its own in-order slide, which doubled Chorus after Verse 1).
    if (song.chorusAfterEachVerse && isChorus) continue;
    out.push({ label: sec.label, lines: sec.lines });
    if (song.chorusAfterEachVerse && chorus && sec.type === 'verse') {
      out.push({ label: chorus.label, lines: chorus.lines });
    }
  }
  return out;
}

function themeColors(theme: PresentTheme) {
  if (theme === 'white') return { bg: 'FFFFFF', n: '111111', r: '5C4A1E', e: '555555' };
  if (theme === 'black') return { bg: '000000', n: 'FFFFFF', r: 'E8C547', e: 'CCCCCC' };
  return { bg: '2E1418', n: 'F7F2EA', r: 'E8C547', e: 'C9B8A0' };
}

function fontFor(lang: string): string {
  if (lang === 'en') return 'Calibri';
  return 'Nirmala UI';
}

function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'Song';
}

export type PptSongInput = {
  id: string;
  song: BookBundleSong;
  layers?: { n?: boolean; r?: boolean; e?: boolean };
};

/** Lazy-load pptxgenjs and download a .pptx for one or more songs. */
export async function downloadPptx(
  songs: PptSongInput[],
  opts: {
    theme?: PresentTheme;
    fileName?: string;
    layers?: { n?: boolean; r?: boolean; e?: boolean };
  } = {},
): Promise<string> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'LAYOUT_16x9';
  const theme = opts.theme ?? 'leather';
  const colors = themeColors(theme);
  const layers = { n: true, r: true, e: true, ...opts.layers };

  for (const { song } of songs) {
    const badge = song.nums[0] ? `${song.nums[0][0]} ${song.nums[0][1]}` : '';
    const face = fontFor(song.lang);
    const title = pptx.addSlide();
    title.background = { color: colors.bg };
    title.addText(badge, {
      x: 0.5,
      y: 2.2,
      w: 12.3,
      h: 0.5,
      fontFace: 'Calibri',
      fontSize: 18,
      color: colors.r,
      align: 'center',
    });
    title.addText(song.t[0], {
      x: 0.5,
      y: 2.8,
      w: 12.3,
      h: 1.2,
      fontFace: face,
      fontSize: 36,
      bold: true,
      color: colors.n,
      align: 'center',
    });
    if (song.t[1]) {
      title.addText(song.t[1], {
        x: 0.5,
        y: 4.1,
        w: 12.3,
        h: 0.5,
        fontFace: 'Calibri',
        fontSize: 18,
        color: colors.r,
        align: 'center',
      });
    }

    for (const sec of expandSections(song)) {
      const slide = pptx.addSlide();
      slide.background = { color: colors.bg };
      slide.addText(sec.label.toUpperCase(), {
        x: 0.5,
        y: 0.3,
        w: 12.3,
        h: 0.4,
        fontFace: 'Calibri',
        fontSize: 12,
        color: colors.e,
        align: 'center',
      });
      const blocks: { text: string; options: Record<string, unknown> }[] = [];
      const notes: string[] = [];
      for (const [n, r, e] of sec.lines) {
        if (layers.n && n) {
          blocks.push({
            text: n,
            options: { fontFace: face, fontSize: 28, bold: true, color: colors.n, breakLine: true },
          });
        }
        if (layers.r && r) {
          blocks.push({
            text: r,
            options: { fontFace: 'Calibri', fontSize: 16, color: colors.r, breakLine: true },
          });
          notes.push(r);
        }
        if (layers.e && e) {
          blocks.push({
            text: e,
            options: {
              fontFace: 'Calibri',
              fontSize: 14,
              italic: true,
              color: colors.e,
              breakLine: true,
            },
          });
          notes.push(e);
        }
        blocks.push({ text: '', options: { breakLine: true } });
      }
      slide.addText(blocks, { x: 0.6, y: 1.0, w: 12.1, h: 5.8, align: 'center', valign: 'middle' });
      if (notes.length) slide.addNotes(notes.join('\n'));
    }
  }

  const first = songs[0]?.song;
  const badgePart = first?.nums[0] ? `${first.nums[0][0]}${first.nums[0][1]}` : 'Set';
  const name =
    opts.fileName ??
    (songs.length === 1
      ? `Stuti-${badgePart}-${slug(first?.t[1] || first?.t[0] || 'Song')}.pptx`
      : `Stuti-Set-${new Date().toISOString().slice(0, 10)}.pptx`);
  await pptx.writeFile({ fileName: name });
  return name;
}

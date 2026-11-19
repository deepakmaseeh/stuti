import { site } from '../site.config';

export type ReportInput = {
  songId: string;
  title: string;
  /** The line as shown in the picker, e.g. "Verse 1: வழி தெரியாத நேரத்தில்". */
  line: string;
  correction: string;
  pageUrl: string;
};

export type ReportConfig = {
  formUrl: string;
  fields: { songId: string; songTitle: string; line: string; correction: string; url: string };
  githubIssueUrl: string;
};

export const MAX_CORRECTION = 1000;

/**
 * Prefilled Google Form link, or the GitHub issue form when no form is configured.
 * GitHub issue forms prefill fields by their `id`: song, line, correction, url
 * (.github/ISSUE_TEMPLATE/lyric-correction.yml must use these ids).
 */
export function reportUrl(r: ReportInput, cfg: ReportConfig = site.report): string {
  const correction = r.correction.slice(0, MAX_CORRECTION);
  if (cfg.formUrl) {
    const u = new URL(cfg.formUrl);
    u.searchParams.set('usp', 'pp_url');
    u.searchParams.set(cfg.fields.songId, r.songId);
    u.searchParams.set(cfg.fields.songTitle, r.title);
    u.searchParams.set(cfg.fields.line, r.line);
    u.searchParams.set(cfg.fields.correction, correction);
    u.searchParams.set(cfg.fields.url, r.pageUrl);
    return u.toString();
  }
  const u = new URL(cfg.githubIssueUrl);
  u.searchParams.set('title', `Correction: ${r.title} (${r.songId})`);
  u.searchParams.set('song', r.songId);
  u.searchParams.set('line', r.line);
  u.searchParams.set('correction', correction);
  u.searchParams.set('url', r.pageUrl);
  return u.toString();
}

/** Plain-text version for the offline "Copy" button. */
export const reportText = (r: ReportInput): string =>
  [
    `Song: ${r.title} (${r.songId})`,
    `Line: ${r.line}`,
    `Correction: ${r.correction}`,
    `Page: ${r.pageUrl}`,
  ].join('\n');

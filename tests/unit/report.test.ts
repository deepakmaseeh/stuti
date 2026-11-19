import { describe, expect, it } from 'vitest';
import { reportText, reportUrl, type ReportConfig, type ReportInput } from '../../src/lib/report';

const input: ReportInput = {
  songId: 'hi-aadi-aur-ant-tu-hi-hai',
  title: 'இயேசுவே என் துணை',
  line: 'Verse 1: வழி தெரியாத நேரத்தில்',
  correction: 'Should be "நேரத்திலே" & not "நேரத்தில்" #2 ?x=1',
  pageUrl: 'https://stuti.pages.dev/song/hi-aadi-aur-ant-tu-hi-hai/',
};

const fields = {
  songId: 'entry.1000001',
  songTitle: 'entry.1000002',
  line: 'entry.1000003',
  correction: 'entry.1000004',
  url: 'entry.1000005',
};

describe('reportUrl', () => {
  it('builds a prefilled Google Form link with every field encoded', () => {
    const cfg: ReportConfig = {
      formUrl: 'https://docs.google.com/forms/d/e/FORMID/viewform',
      fields,
      githubIssueUrl: 'https://github.com/o/r/issues/new?template=lyric-correction.yml',
    };
    const url = reportUrl(input, cfg);
    expect(url.startsWith('https://docs.google.com/forms/d/e/FORMID/viewform?')).toBe(true);
    // Nothing that would break the query string leaks through unencoded.
    const query = url.split('?')[1]!;
    expect(query).not.toMatch(/[ "#]|&not|\?x=/);
    const p = new URL(url).searchParams;
    expect(p.get('usp')).toBe('pp_url');
    expect(p.get(fields.songId)).toBe(input.songId);
    expect(p.get(fields.songTitle)).toBe(input.title);
    expect(p.get(fields.line)).toBe(input.line);
    expect(p.get(fields.correction)).toBe(input.correction);
    expect(p.get(fields.url)).toBe(input.pageUrl);
  });

  it('falls back to the GitHub issue form when no form URL is set', () => {
    const cfg: ReportConfig = {
      formUrl: '',
      fields,
      githubIssueUrl: 'https://github.com/o/r/issues/new?template=lyric-correction.yml',
    };
    const p = new URL(reportUrl(input, cfg)).searchParams;
    expect(p.get('template')).toBe('lyric-correction.yml');
    expect(p.get('title')).toBe(`Correction: ${input.title} (${input.songId})`);
    expect(p.get('song')).toBe(input.songId);
    expect(p.get('line')).toBe(input.line);
    expect(p.get('correction')).toBe(input.correction);
    expect(p.get('url')).toBe(input.pageUrl);
  });

  it('caps very long corrections', () => {
    const cfg: ReportConfig = { formUrl: '', fields, githubIssueUrl: 'https://github.com/o/r/issues/new' };
    const p = new URL(reportUrl({ ...input, correction: 'x'.repeat(5000) }, cfg)).searchParams;
    expect(p.get('correction')).toHaveLength(1000);
  });
});

describe('reportText', () => {
  it('includes every field on its own line', () => {
    expect(reportText(input).split('\n')).toHaveLength(4);
  });
});

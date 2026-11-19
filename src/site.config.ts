export const site = {
  name: 'Stuti',
  tagline: 'Digital hymnal for Indian churches',
  url: 'https://stuti.pages.dev',
  languages: ['hi', 'ta', 'te', 'pa', 'en'] as const,
  defaultBookId: 'DT',
  includeDemo: import.meta.env.PUBLIC_INCLUDE_DEMO === 'true',
  report: {
    // Google Form prefill. Get entry IDs via Form → ⋮ → "Get pre-filled link".
    formUrl: import.meta.env.PUBLIC_REPORT_FORM_URL ?? '',
    fields: {
      songId: 'entry.1000001',
      songTitle: 'entry.1000002',
      line: 'entry.1000003',
      correction: 'entry.1000004',
      url: 'entry.1000005',
    },
    // Fallback when formUrl is empty: GitHub issue form
    githubIssueUrl: 'https://github.com/OWNER/stuti/issues/new?template=lyric-correction.yml',
  },
  analyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  contactEmail: '',
} as const;

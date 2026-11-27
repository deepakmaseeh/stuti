export const site = {
  name: 'Stuti Songs',
  tagline: 'Christian hymnal for Indian churches',
  url: 'https://stuti.deepakmaseeh121.workers.dev',
  languages: ['hi', 'en'] as const,
  defaultBookId: 'TLBC',
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
    githubIssueUrl: 'https://github.com/deepakmaseeh/stuti/issues/new?template=lyric-correction.yml',
    missingSongUrl: 'https://github.com/deepakmaseeh/stuti/issues/new?template=missing-song.yml',
  },
  search: { maxDigits: 4, pageSize: 30, debounceMs: 120 },
  /**
   * Desktop add-on breakpoints (STUTI_DESKTOP_ADDON.md).
   * <900 mobile; 900–1279 Finder+Song (+ Set drawer); ≥1280 three panes.
   */
  layout: {
    desktopMin: 900,
    wideMin: 1280,
    finderWidth: 310,
    finderNarrow: 320,
    setWidth: 320,
    setDrawer: 340,
    songContentMax: 1120,
  },
  analyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  contactEmail: '',
  /** App maker credit (guide / about / settings). */
  maker: {
    name: 'Excel Tech Solutions',
    blurb: 'Premium B2B IT services — web design, apps, and digital growth from Lucknow.',
    url: 'https://exceltechsolutions.com/',
    host: 'exceltechsolutions.com',
    mapsUrl: 'https://share.google/jJqkgsKiRU1oVhj86',
    email: 'Ewtechsolutions@gmail.com',
    phones: ['+919956999832', '+916394981679'] as const,
    phoneLabels: ['+91 99569 99832', '+91 63949 81679'] as const,
    address: '635/200 Hardasi Khera, Chinhat, Lucknow 226028',
  },
} as const;

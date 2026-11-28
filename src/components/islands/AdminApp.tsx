import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  BookOpen,
  Check,
  CircleCheck,
  ClipboardPaste,
  Eye,
  Film,
  Inbox,
  LayoutDashboard,
  Music,
  Plus,
  Save,
  Settings,
  TriangleAlert,
  Upload,
  Users,
  X,
} from 'lucide-preact';
import { splitPastedSong, type SplitStanza } from '../../lib/paste-split';
import { loadMeta } from '../../lib/search';
import type { BookBundle } from '../../lib/book-bundle';

const DRAFT_KEY = 'stuti-admin-draft-v1';
const FIXED_KEY = 'stuti-admin-fixed-ids';

const BOOK_LANG: Record<string, 'hi' | 'en' | 'ta' | 'te' | 'pa'> = {
  TLBC: 'hi',
  TLBE: 'en',
  XMAS: 'hi',
  SS: 'en',
};

function slugFromTitle(title: string, no: string): string {
  const ascii = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (ascii.length >= 2) return ascii;
  return `n-${String(no).replace(/[^0-9a-z-]/gi, '') || 'song'}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildSongJson(opts: {
  bookId: string;
  no: string;
  title: string;
  rights: 'public_domain' | 'licensed' | 'permission_pending' | 'unknown';
  topics: string;
  ytUrl: string;
  ytVideos?: { url: string; label: string }[];
  stanzas: SplitStanza[];
  publish: boolean;
}) {
  const lang = BOOK_LANG[opts.bookId] ?? 'hi';
  const slug = slugFromTitle(opts.title, opts.no);
  const rightsStatus =
    opts.rights === 'unknown' ? 'permission_pending' : opts.rights;
  return {
    lang,
    slug,
    path: `src/content/songs/${lang}/${slug}.json`,
    song: {
      slug,
      numbers: [{ book: opts.bookId, number: opts.no.trim() }],
      title: { native: opts.title.trim(), roman: '', en: '' },
      aliases: [],
      sections: opts.stanzas.map((z) => ({
        type: z.type,
        label: z.label,
        lines: z.lines.map((l) => ({
          n: l.n,
          r: '',
          e: '',
          ...(l.x ? { x: l.x } : {}),
        })),
      })),
      display: { chorusAfterEachVerse: false },
      author: { name: 'Unknown', born: null, died: null },
      composer: null,
      tune: null,
      year: null,
      bibleRefs: [],
      tags: opts.topics
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean),
      rights: {
        status: rightsStatus,
        basis: '',
        evidence: '',
        holder: '',
        checkedBy: '',
        checkedOn: '',
      },
      layers: { roman: 'missing', en: 'missing' },
      source: { scan: 'admin-paste', page: null },
      chords: null,
      media:
        opts.ytVideos && opts.ytVideos.length > 0
          ? opts.ytVideos.map((v) => ({ type: 'youtube', url: v.url, label: v.label }))
          : opts.ytUrl.trim()
            ? [{ type: 'youtube', url: opts.ytUrl.trim(), label: 'YouTube' }]
            : [],
      updated: today(),
      publish: opts.publish && rightsStatus !== 'permission_pending',
    },
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readFixedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FIXED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

type BookStat = { id: string; en: string; count: number; maxNo: number };
type View = 'dash' | 'songs' | 'add' | 'reports' | 'books' | 'media' | 'users' | 'site';
type SheetReport = {
  timestamp: string;
  id: string;
  status: string;
  book: string;
  no: string;
  title: string;
  stanza: string;
  line: string;
  kind: string;
  current: string;
  suggested: string;
  note: string;
  name: string;
};

const SAMPLE = `46 चमका सितारा देखो

1. स्वर्गीय पिता का आया संदेशा, मरियम जनेगी एक ऐसा बेटा (2)
इमानुएल है जिसका नाम, हरदम रहेगा वो तेरे साथ

कोरस
- चमका सितारा देखो, चमका सितारा देखो, चमका सितारा रे (2)
देखो आया यीशु जग में, सारे जग का वो राजा है (2)

2. दूतों ने मिलकर गीत ये गाया, चरनी में आया हम सब का राजा (2)
सारे लोगों को छुटकारा देता, पापी जीवन से मुक्ति दिलाता`;

const NAV: readonly [View, string, typeof LayoutDashboard, number?][] = [
  ['dash', 'Dashboard', LayoutDashboard],
  ['songs', 'Songs', Music],
  ['add', 'Add song', Plus],
  ['reports', 'Reports', Inbox],
  ['books', 'Books & topics', BookOpen],
  ['media', 'Videos', Film],
  ['users', 'Users', Users],
  ['site', 'Site settings', Settings],
];

export default function AdminApp({
  books,
  totalSongs,
}: {
  books: BookStat[];
  totalSongs: number;
}) {
  const [view, setView] = useState<View>('dash');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [text, setText] = useState(SAMPLE);
  const [bookId, setBookId] = useState(books[0]?.id ?? 'TLBC');
  const [no, setNo] = useState('440');
  const [title, setTitle] = useState('चमका सितारा देखो');
  const [rights, setRights] = useState<'public_domain' | 'licensed' | 'permission_pending' | 'unknown'>('public_domain');
  const [topics, setTopics] = useState('Christmas');
  const [ytUrl, setYtUrl] = useState('');
  const [ytStatus, setYtStatus] = useState<string | null>(null);
  const [ytVideos, setYtVideos] = useState<{ url: string; label: string }[]>([]);
  const [videoFilter, setVideoFilter] = useState<'all' | 'has' | 'none' | 'broken'>('all');
  const [videoSongs, setVideoSongs] = useState<{ id: string; title: string; badge: string; count: number; broken: boolean }[]>([]);
  const [videoSongInputs, setVideoSongInputs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [reports, setReports] = useState<SheetReport[]>([]);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [reportsNote, setReportsNote] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(() =>
    typeof localStorage !== 'undefined' ? readFixedIds() : new Set(),
  );
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authVia, setAuthVia] = useState<'access' | 'password' | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        text?: string;
        bookId?: string;
        no?: string;
        title?: string;
        rights?: typeof rights;
        topics?: string;
        ytUrl?: string;
      };
      if (d.text) setText(d.text);
      if (d.bookId) setBookId(d.bookId);
      if (d.no) setNo(d.no);
      if (d.title) setTitle(d.title);
      if (d.rights) setRights(d.rights);
      if (d.topics) setTopics(d.topics);
      if (d.ytUrl) setYtUrl(d.ytUrl);
    } catch {
      /* ignore bad draft */
    }
  }, []);

  const loadReports = () => {
    fetch('/api/admin/reports', { credentials: 'same-origin' })
      .then(async (r) => {
        if (r.status === 403) {
          setReportsNote('Sign in with the admin password to load live Google Sheet reports.');
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as {
          reports?: SheetReport[];
          sheetUrl?: string | null;
          notConfigured?: boolean;
        };
        setReports(d.reports ?? []);
        setSheetUrl(d.sheetUrl ?? null);
        if (d.notConfigured) {
          setReportsNote('Set GOOGLE_SHEET_CSV_URL on the Worker to show live Sheet rows here.');
        } else {
          setReportsNote(null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'same-origin' })
      .then(async (r) => {
        if (r.status === 403) {
          setNeedsLogin(true);
          setUserEmail(null);
          return;
        }
        // Static preview / missing Worker → show UI without login (e2e + astro preview).
        if (r.status === 404 || r.status >= 500) {
          setNeedsLogin(false);
          setReportsNote('Admin API not reachable here — sign-in applies on the live Worker site.');
          return;
        }
        if (!r.ok) {
          setNeedsLogin(true);
          return;
        }
        const d = (await r.json()) as { email?: string; via?: 'access' | 'password' };
        if (d?.email) {
          setUserEmail(d.email);
          setAuthVia(d.via ?? null);
          setNeedsLogin(false);
          loadReports();
        } else {
          setNeedsLogin(true);
        }
      })
      .catch(() => {
        setNeedsLogin(false);
        setReportsNote('Admin API offline — UI preview only.');
      });
  }, []);

  const login = async (e: Event) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; email?: string; error?: string; hint?: string };
      if (!res.ok || !data.ok) {
        setLoginError(
          data.error === 'password_not_configured'
            ? data.hint || 'ADMIN_PASSWORD secret not set on Worker'
            : 'Wrong password',
        );
        return;
      }
      setUserEmail(data.email || 'editor (password)');
      setAuthVia('password');
      setNeedsLogin(false);
      setPassword('');
      loadReports();
      setToast('Signed in');
    } catch {
      setLoginError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    setUserEmail(null);
    setAuthVia(null);
    setNeedsLogin(true);
    setReports([]);
    setReportsNote('Sign in to load reports.');
  };

  const stanzas = useMemo(() => splitPastedSong(text), [text]);
  const selectedBook = books.find((b) => b.id === bookId) ?? books[0];
  const nextFree = selectedBook ? selectedBook.maxNo + 1 : 440;

  const checks: [boolean, string][] = [
    [Boolean(no.trim()) && /^\d+$/.test(no.trim()), no.trim() ? `Number ${no} ready` : 'Enter hymn number'],
    [stanzas.length > 0, `${stanzas.length} stanzas detected`],
    [stanzas.every((z) => z.lines.every((l) => !/\(2\)/.test(l.n))), 'Repeat marks turned into ×2'],
    [rights !== 'unknown', rights === 'unknown' ? "Rights unknown: can't publish" : 'Rights set'],
  ];
  const canPublish = checks.every((c) => c[0]);
  const maxBookCount = Math.max(1, ...books.map((b) => b.count));

  const visibleReports = useMemo(
    () =>
      reports.map((r) =>
        r.id && fixedIds.has(r.id) ? { ...r, status: 'Fixed' } : r,
      ),
    [reports, fixedIds],
  );

  const saveDraft = () => {
    const payload = {
      text,
      bookId,
      no,
      title,
      rights,
      topics,
      ytUrl,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    const built = buildSongJson({
      bookId,
      no,
      title,
      rights,
      topics,
      ytUrl,
      stanzas,
      publish: false,
    });
    downloadJson(`${built.slug}.draft.json`, built.song);
    setToast('Draft saved in this browser and downloaded as JSON');
  };

  const publishSong = async () => {
    if (!canPublish || busy) return;
    setBusy(true);
    const built = buildSongJson({
      bookId,
      no,
      title,
      rights,
      topics,
      ytUrl,
      ytVideos,
      stanzas,
      publish: true,
    });
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: built.path,
          content: built.song,
          message: `admin: add ${built.lang}/${built.slug} (${bookId} ${no})`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        url?: string | null;
        branch?: string;
      };
      if (res.status === 403) {
        setNeedsLogin(true);
        setToast('Sign in with the admin password to publish');
      } else if (res.status === 503 || data.error === 'github_token_missing') {
        downloadJson(`${built.slug}.json`, built.song);
        setToast(
          'GITHUB_TOKEN not set on Worker — JSON downloaded. Run: npx wrangler secret put GITHUB_TOKEN',
        );
      } else if (!res.ok || !data.ok) {
        downloadJson(`${built.slug}.json`, built.song);
        setToast(`Publish failed (${data.error || res.status}) — JSON downloaded as fallback`);
      } else {
        localStorage.removeItem(DRAFT_KEY);
        setToast(
          `Published to GitHub (${data.branch || 'main'}). Redeploy the Worker to go live.${data.url ? ` ${data.url}` : ''}`,
        );
      }
    } catch {
      downloadJson(`${built.slug}.json`, built.song);
      setToast('Network error — JSON downloaded');
    } finally {
      setBusy(false);
    }
  };

  const markFixed = (id: string) => {
    if (!id) return;
    const next = new Set(fixedIds);
    next.add(id);
    setFixedIds(next);
    localStorage.setItem(FIXED_KEY, JSON.stringify([...next]));
    setToast(
      sheetUrl
        ? 'Marked Fixed here. Also set Status=Fixed in the Google Sheet.'
        : 'Marked Fixed in this browser. Set Status=Fixed in the Sheet when you open it.',
    );
  };

  const onCsvPicked = async (file: File | undefined) => {
    if (!file) return;
    const textCsv = await file.text();
    const lines = textCsv.split(/\r?\n/).filter((l) => l.trim());
    setToast(`CSV loaded (${Math.max(0, lines.length - 1)} data rows). Paste rows into Add song one-by-one for now.`);
  };

  const checkYoutube = async () => {
    const targetUrl = ytUrl.trim();
    if (!targetUrl) return;
    setYtStatus('Checking…');
    try {
      const res = await fetch('/api/admin/oembed', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (res.status === 403) {
        setNeedsLogin(true);
        setYtStatus('Sign in with the admin password to verify');
        return;
      }
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { title?: string };
        setYtVideos((prev) =>
          prev.some((v) => v.url === targetUrl)
            ? prev
            : [...prev, { url: targetUrl, label: data.title || 'YouTube' }],
        );
        setYtUrl('');
        setYtStatus('Embed allowed (OK) — added to list');
      } else {
        setYtStatus("This video can't play inside the app");
      }
    } catch {
      setYtStatus('Offline — could not verify');
    }
  };

  useEffect(() => {
    if (view !== 'media' || videoSongs.length > 0) return;
    loadMeta()
      .then(async (meta) => {
        const rows: { id: string; title: string; badge: string; count: number; broken: boolean }[] = [];
        const bundles: Record<string, BookBundle> = {};
        await Promise.all(
          books.map(async (b) => {
            const res = await fetch(`/data/books/${encodeURIComponent(b.id)}.json`).catch(() => null);
            if (res?.ok) bundles[b.id] = (await res.json()) as BookBundle;
          }),
        );
        for (const [id, m] of Object.entries(meta)) {
          const [b, n = ''] = (m?.[3] ?? '').trim().split(/\s+/);
          const s = b ? bundles[b]?.songs?.[id] : undefined;
          const mediaCount = Array.isArray((s as { media?: unknown[] } | undefined)?.media)
            ? ((s as { media?: unknown[] }).media?.length ?? 0)
            : 0;
          rows.push({
            id,
            title: m?.[0] ?? id,
            badge: b ? `${b} ${n}`.trim() : id,
            count: mediaCount,
            broken: false,
          });
        }
        setVideoSongs(rows.slice(0, 120));
      })
      .catch(() => {});
  }, [view]);

  return (
    <div class="adm">
      <aside class="side">
        <div class="brand">
          Stuti Songs<small>ADMIN</small>
        </div>
        <nav class="side-nav" aria-label="Admin">
          {NAV.map(([id, label, Icon, count]) => (
            <button
              type="button"
              key={id}
              class={view === id ? 'on' : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
              {count ? <span class="cnt">{count}</span> : null}
            </button>
          ))}
        </nav>
        <div class="me">
          {userEmail ? (
            <>
              {userEmail}
              <br />
              {authVia === 'password' ? 'Signed in with password · ' : 'Signed in · '}
              <button type="button" class="link-v3" style={{ padding: 0, border: 0, background: 'none' }} onClick={() => void logout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              Not signed in
              <br />
              <a href="/" style={{ color: 'var(--gold)' }}>
                ← Back to app
              </a>
            </>
          )}
        </div>
      </aside>

      <main class="amain">
        {toast ? (
          <div class="notice" style={{ marginBottom: 14 }}>
            {toast}
          </div>
        ) : null}

        {needsLogin ? (
          <div class="adm-card" style={{ maxWidth: 420 }}>
            <h1 style={{ marginTop: 0 }}>Editor sign-in</h1>
            <p class="muted sm">
              Free password login (no Cloudflare Zero Trust). Ask the site owner for the admin password.
            </p>
            <form onSubmit={(e) => void login(e)}>
              <label class="fl">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                />
              </label>
              {loginError ? (
                <p class="muted sm" style={{ color: 'var(--ribbon)', marginTop: 8 }}>
                  {loginError}
                </p>
              ) : null}
              <button type="submit" class="abtn pri" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} disabled={busy || !password.trim()}>
                Sign in
              </button>
            </form>
          </div>
        ) : null}

        {!needsLogin ? (
          <>
        {view === 'dash' ? (
          <>
            <div class="ahead">
              <h1>Dashboard</h1>
              <input
                ref={csvRef}
                type="file"
                accept=".csv,text/csv"
                class="visually-hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  void onCsvPicked(f);
                  e.currentTarget.value = '';
                }}
              />
              <button type="button" class="abtn" onClick={() => csvRef.current?.click()}>
                <Upload size={17} strokeWidth={1.75} aria-hidden="true" />
                Import CSV
              </button>
              <button type="button" class="abtn pri" onClick={() => setView('add')}>
                <ClipboardPaste size={17} strokeWidth={1.75} aria-hidden="true" />
                Paste a song
              </button>
            </div>
            <div class="adm-grid">
              <section class="adm-card">
                <h3>Songs</h3>
                <div class="big">{totalSongs}</div>
                <div class="bars">
                  {books.map((b) => (
                    <div class="b" key={b.id}>
                      <b style={{ font: '700 13px var(--font-display)' }}>{b.id}</b>
                      <span class="t">
                        <i style={{ width: `${Math.max(4, (b.count / maxBookCount) * 100)}%` }} />
                      </span>
                      <span style={{ textAlign: 'right' }}>{b.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section class="adm-card">
                <h3>Needs attention</h3>
                <div class="att">
                  <span>Pending songs</span>
                  <b>
                    <span class="pillx wait">2</span>
                  </b>
                </div>
                <div class="att">
                  <span>Broken video links</span>
                  <b>
                    <span class="pillx ok">0</span>
                  </b>
                </div>
                <div class="att">
                  <span>Lint errors</span>
                  <b>
                    <span class="pillx ok">0</span>
                  </b>
                </div>
              </section>

              <section class="adm-card">
                <h3>Publishing</h3>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <CircleCheck size={32} color="var(--ok)" strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 700 }}>Live</div>
                    <div class="muted sm">Static build + Worker API</div>
                  </div>
                </div>
              </section>

              <section class="adm-card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>New reports ({visibleReports.length})</h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {sheetUrl ? (
                      <a class="link-v3" href={sheetUrl} target="_blank" rel="noopener noreferrer">
                        Open Google Sheet
                      </a>
                    ) : null}
                    <button type="button" class="link-v3" onClick={() => setView('reports')}>
                      Open inbox
                    </button>
                  </div>
                </div>
                {visibleReports.length > 0 ? (
                  visibleReports.slice(0, 5).map((r, i) => (
                    <div class="att" key={r.id || i}>
                      <b style={{ margin: 0, font: '700 14px var(--font-display)', color: 'var(--ribbon)', minWidth: 68 }}>
                        {r.book} {r.no}
                      </b>
                      <span>
                        {r.stanza ? `${r.stanza} · ` : ''}
                        {r.kind || 'Correction'}
                        {r.suggested ? ` → ${r.suggested.slice(0, 48)}` : ''}
                      </span>
                      <b>
                        <span class={`pillx ${r.status === 'Fixed' ? 'ok' : 'new'}`}>{r.status || 'New'}</span>
                      </b>
                    </div>
                  ))
                ) : (
                  <p class="muted sm" style={{ margin: '6px 0 0' }}>
                    {reportsNote || 'No reports yet.'}
                  </p>
                )}
              </section>
            </div>
          </>
        ) : null}

        {view === 'add' ? (
          <>
            <div class="ahead">
              <h1>Add song</h1>
              <span class="pillx wait">Draft</span>
              <button type="button" class="abtn" disabled={busy} onClick={saveDraft}>
                <Save size={17} strokeWidth={1.75} aria-hidden="true" />
                Save draft
              </button>
              <button
                type="button"
                class="abtn pri"
                disabled={!canPublish || busy}
                onClick={() => void publishSong()}
              >
                Publish
              </button>
            </div>

            <div class="ed2">
              <div>
                <div class="f2">
                  <label class="fl">
                    Book
                    <select value={bookId} onChange={(e) => setBookId(e.currentTarget.value)}>
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label class="fl">
                    Number
                    <input value={no} onInput={(e) => setNo(e.currentTarget.value)} />
                    <span class="hint">Next free: {nextFree}</span>
                  </label>
                  <label class="fl">
                    Rights
                    <select
                      value={rights}
                      onChange={(e) => setRights(e.currentTarget.value as typeof rights)}
                    >
                      <option value="public_domain">Public domain</option>
                      <option value="licensed">Licensed (CCLI…)</option>
                      <option value="permission_pending">Permission pending</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                  <label class="fl" style={{ gridColumn: 'span 2' }}>
                    Title
                    <input
                      class="hi"
                      value={title}
                      onInput={(e) => setTitle(e.currentTarget.value)}
                    />
                  </label>
                  <label class="fl">
                    Topics
                    <input value={topics} onInput={(e) => setTopics(e.currentTarget.value)} />
                  </label>
                </div>

                <label class="fl" style={{ marginTop: 16 }}>
                  Paste the whole song
                  <textarea
                    rows={9}
                    value={text}
                    onInput={(e) => setText(e.currentTarget.value)}
                  />
                  <span class="hint">Blank line = new stanza · "कोरस/Chorus" = chorus · "(2)" = ×2</span>
                </label>

                <div class="adm-card" style={{ marginTop: 16 }}>
                  <h3>Split result ({stanzas.length} stanzas)</h3>
                  {stanzas.map((z, i) => (
                    <div class="stc" key={`${z.label}-${i}`}>
                      <div class="ty">{z.label}</div>
                      {z.lines.map((l, j) => (
                        <div class="l" key={j}>
                          {l.n}
                          {l.x ? <span class="x">×{l.x}</span> : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div class="adm-card">
                  <h3>Checks</h3>
                  {checks.map(([ok, msg], i) => (
                    <div class="chk" key={i}>
                      {ok ? (
                        <Check size={16} color="var(--ok)" strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <TriangleAlert size={16} color="var(--ribbon)" strokeWidth={2} aria-hidden="true" />
                      )}
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>

                <div class="adm-card" style={{ marginTop: 14 }}>
                  <h3>Videos</h3>
                  <label class="fl">
                    YouTube link
                    <input
                      type="url"
                      placeholder="https://youtu.be/..."
                      value={ytUrl}
                      onInput={(e) => setYtUrl(e.currentTarget.value)}
                    />
                  </label>
                  <button
                    type="button"
                    class="abtn"
                    style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                    onClick={() => void checkYoutube()}
                  >
                    <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                    Check &amp; add video
                  </button>
                  {ytStatus ? <p class="muted sm" style={{ marginTop: 8 }}>{ytStatus}</p> : null}
                  {ytVideos.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      {ytVideos.map((v, vi) => (
                        <div key={v.url} class="att" style={{ padding: '6px 0' }}>
                          <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.label}
                          </span>
                          <button
                            type="button"
                            class="ib ink"
                            aria-label="Remove video"
                            onClick={() => setYtVideos((prev) => prev.filter((_, i2) => i2 !== vi))}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {view === 'reports' ? (
          <>
            <div class="ahead">
              <h1>Reports inbox</h1>
              {sheetUrl ? (
                <a class="abtn" href={sheetUrl} target="_blank" rel="noopener noreferrer">
                  Open Google Sheet
                </a>
              ) : null}
            </div>
            <div class="adm-card">
              {visibleReports.length > 0 ? (
                visibleReports.map((r, i) => (
                  <div class="att" key={r.id || i} style={{ flexWrap: 'wrap' }}>
                    <b style={{ margin: 0, font: '700 14px var(--font-display)', color: 'var(--ribbon)', minWidth: 72 }}>
                      {r.book} {r.no}
                    </b>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 600 }}>
                        {r.title} · {r.kind}
                      </div>
                      {r.current || r.suggested ? (
                        <div class="muted sm">
                          {r.current ? <del>{r.current}</del> : null}
                          {r.current && r.suggested ? ' → ' : null}
                          {r.suggested ? <strong>{r.suggested}</strong> : null}
                        </div>
                      ) : null}
                    </div>
                    <span class={`pillx ${r.status === 'Fixed' ? 'ok' : 'new'}`}>{r.status || 'New'}</span>
                    {r.id && r.status !== 'Fixed' ? (
                      <button type="button" class="abtn" style={{ padding: '6px 10px' }} onClick={() => markFixed(r.id)}>
                        Mark fixed
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p class="muted">{reportsNote || 'No reports in the Sheet yet.'}</p>
              )}
            </div>
          </>
        ) : null}

        {view === 'media' ? (
          <>
            <div class="ahead">
              <h1>Videos</h1>
            </div>
            <div class="segtabs" style={{ marginBottom: 14 }}>
              {(
                [
                  ['all', 'All songs'],
                  ['has', 'Has video'],
                  ['none', 'No video'],
                  ['broken', 'Broken links'],
                ] as const
              ).map(([fid, flabel]) => (
                <button
                  key={fid}
                  type="button"
                  class={videoFilter === fid ? 'on' : undefined}
                  onClick={() => setVideoFilter(fid)}
                >
                  {flabel}
                </button>
              ))}
            </div>
            <div class="adm-card">
              {videoSongs
                .filter((s) => {
                  if (videoFilter === 'has') return s.count > 0;
                  if (videoFilter === 'none') return s.count === 0;
                  if (videoFilter === 'broken') return s.broken;
                  return true;
                })
                .map((s) => (
                  <div class="att" key={s.id} style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <b style={{ minWidth: 72, color: 'var(--ribbon)' }}>{s.badge}</b>
                    <span style={{ flex: 1, minWidth: 160 }}>{s.title}</span>
                    <span class={`pillx ${s.count > 0 ? 'ok' : 'new'}`}>
                      {s.count > 0 ? `${s.count} video` : 'No video'}
                    </span>
                    <input
                      type="url"
                      placeholder="https://youtu.be/..."
                      value={videoSongInputs[s.id] ?? ''}
                      onInput={(e) =>
                        setVideoSongInputs((prev) => ({ ...prev, [s.id]: e.currentTarget.value }))
                      }
                      style={{ width: '180px' }}
                    />
                    <button
                      type="button"
                      class="abtn"
                      onClick={async () => {
                        const u = (videoSongInputs[s.id] ?? '').trim();
                        if (!u) return;
                        const res = await fetch('/api/admin/oembed', {
                          method: 'POST',
                          credentials: 'same-origin',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ url: u }),
                        }).catch(() => null);
                        if (res?.ok) {
                          setVideoSongs((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, count: x.count + 1 } : x)),
                          );
                          setVideoSongInputs((prev) => ({ ...prev, [s.id]: '' }));
                          setToast(`Verified & staged video for ${s.badge}`);
                        } else {
                          setVideoSongs((prev) =>
                            prev.map((x) => (x.id === s.id ? { ...x, broken: true } : x)),
                          );
                          setToast("This video can't play inside the app");
                        }
                      }}
                    >
                      Check
                    </button>
                  </div>
                ))}
            </div>
          </>
        ) : null}

        {view !== 'dash' && view !== 'add' && view !== 'reports' && view !== 'media' ? (
          <div class="adm-card">
            <h2 style={{ marginTop: 0 }}>{NAV.find((n) => n[0] === view)?.[1]}</h2>
            <p class="muted">
              This section is a placeholder. Use Add song, Reports, and Dashboard for live tools. Decap CMS remains at{' '}
              <a href="/admin/cms/">/admin/cms/</a>.
            </p>
            <button type="button" class="abtn" onClick={() => setView('dash')}>
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
              Back to Dashboard
            </button>
          </div>
        ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'preact/hooks';
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
import { splitPastedSong } from '../../lib/paste-split';

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
  const [toast, setToast] = useState<string | null>(null);
  const [reports, setReports] = useState<SheetReport[]>([]);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [reportsNote, setReportsNote] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => (r.ok ? (r.json() as Promise<{ email?: string }>) : null))
      .then((d) => {
        if (d?.email) setUserEmail(d.email);
      })
      .catch(() => {});
    fetch('/api/admin/reports')
      .then(async (r) => {
        if (r.status === 403) {
          setReportsNote('Sign in via Cloudflare Access to load live Google Sheet reports.');
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
        }
      })
      .catch(() => {});
  }, []);

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

  const checkYoutube = async () => {
    if (!ytUrl.trim()) return;
    setYtStatus('Checking…');
    try {
      const res = await fetch('/api/admin/oembed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: ytUrl.trim() }),
      });
      if (res.status === 403) {
        setYtStatus('Sign in via Cloudflare Access to verify live');
        return;
      }
      setYtStatus(res.ok ? 'Embed allowed (OK)' : "This video can't play inside the app");
    } catch {
      setYtStatus('Offline — could not verify');
    }
  };

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
              Signed in with email code ·{' '}
              <a href="/cdn-cgi/access/logout" style={{ color: 'var(--gold)' }}>
                Sign out
              </a>
            </>
          ) : (
            <>
              Preview mode (Cloudflare Access off)
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

        {view === 'dash' ? (
          <>
            <div class="ahead">
              <h1>Dashboard</h1>
              <button type="button" class="abtn" onClick={() => setToast('CSV import ready after Cloudflare Access setup')}>
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
                  <h3 style={{ margin: 0 }}>New reports ({reports.length})</h3>
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
                {reports.length > 0 ? (
                  reports.slice(0, 5).map((r, i) => (
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
              <button type="button" class="abtn" onClick={() => setToast('Draft saved locally')}>
                <Save size={17} strokeWidth={1.75} aria-hidden="true" />
                Save draft
              </button>
              <button
                type="button"
                class="abtn pri"
                disabled={!canPublish}
                onClick={() => setToast('Publish connects to GitHub after Cloudflare Access setup')}
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
                    Check embeddable
                  </button>
                  {ytStatus ? <p class="muted sm" style={{ marginTop: 8 }}>{ytStatus}</p> : null}
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
              {reports.length > 0 ? (
                reports.map((r, i) => (
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
                  </div>
                ))
              ) : (
                <p class="muted">{reportsNote || 'No reports in the Sheet yet.'}</p>
              )}
            </div>
          </>
        ) : null}

        {view !== 'dash' && view !== 'add' && view !== 'reports' ? (
          <div class="adm-card">
            <h2 style={{ marginTop: 0 }}>{NAV.find((n) => n[0] === view)?.[1]}</h2>
            <p class="muted">
              Connect Cloudflare Access One-time PIN + GitHub token on the Worker to manage {view} live.
            </p>
            <button type="button" class="abtn" onClick={() => setView('dash')}>
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
              Back to Dashboard
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

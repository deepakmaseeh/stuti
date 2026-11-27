/** Cloudflare Worker: static assets + POST /api/report → Google Form → Sheet. */

export interface Env {
  ASSETS: Fetcher;
  /** e.g. https://docs.google.com/forms/d/e/XXXX/formResponse */
  GOOGLE_FORM_ACTION_URL?: string;
  /**
   * JSON map of MistakeReport keys → Google Form entry.XXXXXXXX ids.
   * Example: {"id":"entry.123","title":"entry.456","kind":"entry.789",...}
   */
  GOOGLE_FORM_ENTRIES?: string;
  /** Optional published-to-web CSV URL of the linked Google Sheet for /api/admin/reports. */
  GOOGLE_SHEET_CSV_URL?: string;
  /** Optional Google Sheet edit URL shown in the Admin Dashboard. */
  GOOGLE_SHEET_URL?: string;
  /** Optional comma-separated allowlist of admin emails. Defaults to godisourlord8874@gmail.com. */
  ADMIN_EMAILS?: string;
  /** GitHub PAT with `contents:write` on deepakmaseeh/stuti — enables Publish from /admin/. */
  GITHUB_TOKEN?: string;
  /** Repo `owner/name` for admin publish (default deepakmaseeh/stuti). */
  GITHUB_REPO?: string;
  /** Branch to commit song JSON into (default main). */
  GITHUB_BRANCH?: string;
  /** Free sole-editor password (no Cloudflare Zero Trust). Sets HttpOnly cookie on login. */
  ADMIN_PASSWORD?: string;
  APP_ORIGIN?: string;
  REPORT_LIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}

const ADMIN_COOKIE = 'stuti_admin';
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function adminSessionToken(password: string): Promise<string> {
  return sha256Hex(`stuti-admin-v1|${password}`);
}

function parseCookie(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function adminCookieHeader(token: string, clear = false): string {
  if (clear) {
    return `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  }
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${ADMIN_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

type AdminAuth =
  | { ok: true; label: string; via: 'access' | 'password' }
  | { ok: false };

async function authorizeAdmin(request: Request, env: Env): Promise<AdminAuth> {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
  const allowed = (env.ADMIN_EMAILS || 'godisourlord8874@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (email && allowed.includes(email.toLowerCase())) {
    return { ok: true, label: email, via: 'access' };
  }

  if (env.ADMIN_PASSWORD) {
    const expected = await adminSessionToken(env.ADMIN_PASSWORD);
    const cookies = parseCookie(request.headers.get('Cookie'));
    if (cookies[ADMIN_COOKIE] === expected) {
      return { ok: true, label: 'editor (password)', via: 'password' };
    }
    const auth = request.headers.get('Authorization')?.trim();
    if (auth?.toLowerCase().startsWith('bearer ')) {
      const bearer = auth.slice(7).trim();
      if (bearer === env.ADMIN_PASSWORD || bearer === expected) {
        return { ok: true, label: 'editor (password)', via: 'password' };
      }
    }
  }

  return { ok: false };
}

type ReportBody = {
  id?: string;
  website?: string;
  book?: string;
  no?: number | string;
  title?: string;
  layer?: string;
  stanzaLabel?: string;
  lineIndex?: number | string;
  kind?: string;
  current?: string;
  suggested?: string;
  note?: string;
  name?: string;
  church?: string;
  contact?: string;
  appVersion?: string;
  dataVersion?: string;
  url?: string;
  [key: string]: unknown;
};

const KIND_LABEL: Record<string, string> = {
  spelling: 'Spelling',
  words: 'Wrong words',
  missing: 'Missing line/verse',
  order: 'Wrong order',
  number: 'Wrong hymn number',
  roman: 'Roman',
  english: 'English',
  other: 'Other',
};

const corsHeaders = (origin: string | null, allow: string): HeadersInit => {
  const o = origin && (origin === allow || allow === '*') ? origin : allow;
  return {
    'access-control-allow-origin': o,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
};

function parseEntries(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.startsWith('entry.')) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function buildFormBody(body: ReportBody, entries: Record<string, string>): URLSearchParams {
  const values: Record<string, string> = {
    id: String(body.id ?? ''),
    book: String(body.book ?? ''),
    no: body.no === undefined || body.no === '' ? '' : String(body.no),
    title: String(body.title ?? ''),
    layer: String(body.layer ?? ''),
    stanzaLabel: String(body.stanzaLabel ?? ''),
    lineIndex:
      body.lineIndex === undefined || body.lineIndex === ''
        ? ''
        : String(Number(body.lineIndex) + 1),
    kind: KIND_LABEL[String(body.kind ?? '')] || String(body.kind ?? ''),
    current: String(body.current ?? ''),
    suggested: String(body.suggested ?? ''),
    note: String(body.note ?? ''),
    name: String(body.name ?? ''),
    church: String(body.church ?? ''),
    contact: String(body.contact ?? ''),
    appVersion: String(body.appVersion ?? ''),
    dataVersion: String(body.dataVersion ?? ''),
    url: String(body.url ?? ''),
    status: 'New',
  };

  const params = new URLSearchParams();
  for (const [key, entryId] of Object.entries(entries)) {
    if (key in values) params.set(entryId, values[key]!);
  }
  return params;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allow = env.APP_ORIGIN || 'https://stuti.deepakmaseeh121.workers.dev';
    const origin = request.headers.get('Origin');

    if (url.pathname.startsWith('/api/admin')) {
      // Password login/logout — no prior auth required (free alternative to Zero Trust).
      if (url.pathname === '/api/admin/login' && request.method === 'POST') {
        if (!env.ADMIN_PASSWORD) {
          return Response.json(
            { ok: false, error: 'password_not_configured', hint: 'npx wrangler secret put ADMIN_PASSWORD' },
            { status: 503 },
          );
        }
        let body: { password?: string } = {};
        try {
          body = (await request.json()) as { password?: string };
        } catch {
          return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
        }
        if (!body.password || body.password !== env.ADMIN_PASSWORD) {
          return Response.json({ ok: false, error: 'bad_password' }, { status: 401 });
        }
        const token = await adminSessionToken(env.ADMIN_PASSWORD);
        return new Response(JSON.stringify({ ok: true, email: 'editor (password)', role: 'editor' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': adminCookieHeader(token),
          },
        });
      }
      if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': adminCookieHeader('', true),
          },
        });
      }

      const auth = await authorizeAdmin(request, env);
      if (!auth.ok) {
        return Response.json(
          {
            ok: false,
            error: 'forbidden',
            authModes: {
              access: true,
              password: Boolean(env.ADMIN_PASSWORD),
            },
          },
          { status: 403 },
        );
      }
      if (url.pathname === '/api/admin/me') {
        return Response.json({ ok: true, email: auth.label, role: 'editor', via: auth.via });
      }
      if (url.pathname === '/api/admin/reports' && request.method === 'GET') {
        if (!env.GOOGLE_SHEET_CSV_URL) {
          return Response.json({
            ok: true,
            notConfigured: true,
            sheetUrl: env.GOOGLE_SHEET_URL || null,
            reports: [],
          });
        }
        const csvRes = await fetch(env.GOOGLE_SHEET_CSV_URL);
        if (!csvRes.ok) {
          return Response.json({ ok: false, error: 'sheet_fetch_failed' }, { status: 502 });
        }
        const rows = parseCsv(await csvRes.text());
        const headers = rows[0] ?? [];
        const idx = (name: string) =>
          headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
        const reports = rows
          .slice(1)
          .map((r) => ({
            timestamp: r[0] ?? '',
            id: r[idx('Report ID')] ?? '',
            status: r[idx('Status')] || 'New',
            book: r[idx('Book')] ?? '',
            no: r[idx('Number')] ?? '',
            title: r[idx('Title')] ?? '',
            stanza: r[idx('Stanza')] ?? '',
            line: r[idx('Line')] ?? '',
            kind: r[idx("What's wrong")] ?? '',
            current: r[idx('Current text')] ?? '',
            suggested: r[idx('Correct text')] ?? '',
            note: r[idx('Note')] ?? '',
            name: r[idx('Name')] ?? '',
          }))
          .reverse()
          .slice(0, 100);
        return Response.json({
          ok: true,
          sheetUrl: env.GOOGLE_SHEET_URL || null,
          reports,
        });
      }
      if (url.pathname === '/api/admin/oembed' && request.method === 'POST') {
        let payload: { url?: string } = {};
        try {
          payload = (await request.json()) as { url?: string };
        } catch {
          return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
        }
        if (!payload.url) return Response.json({ ok: false, error: 'missing_url' }, { status: 400 });
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(payload.url)}&format=json`,
        );
        return Response.json({ ok: oembed.ok, status: oembed.status }, { status: oembed.ok ? 200 : 422 });
      }
      if (url.pathname === '/api/admin/publish' && request.method === 'POST') {
        if (!env.GITHUB_TOKEN) {
          return Response.json(
            { ok: false, error: 'github_token_missing', hint: 'npx wrangler secret put GITHUB_TOKEN' },
            { status: 503 },
          );
        }
        let payload: {
          path?: string;
          content?: unknown;
          message?: string;
        } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
        }
        const relPath = String(payload.path ?? '').replace(/^\/+/, '');
        if (!relPath.startsWith('src/content/songs/') || !relPath.endsWith('.json')) {
          return Response.json({ ok: false, error: 'bad_path' }, { status: 400 });
        }
        if (payload.content == null || typeof payload.content !== 'object') {
          return Response.json({ ok: false, error: 'missing_content' }, { status: 400 });
        }
        const repo = env.GITHUB_REPO || 'deepakmaseeh/stuti';
        const branch = env.GITHUB_BRANCH || 'main';
        const apiBase = `https://api.github.com/repos/${repo}/contents/${relPath}`;
        const headers = {
          authorization: `Bearer ${env.GITHUB_TOKEN}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': 'stuti-admin-worker',
          'x-github-api-version': '2022-11-28',
        };
        let sha: string | undefined;
        const existing = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
        if (existing.ok) {
          const meta = (await existing.json()) as { sha?: string };
          sha = meta.sha;
        } else if (existing.status !== 404) {
          return Response.json(
            { ok: false, error: 'github_read_failed', status: existing.status },
            { status: 502 },
          );
        }
        const bodyJson = JSON.stringify(payload.content, null, 2) + '\n';
        const encoded = btoa(unescape(encodeURIComponent(bodyJson)));
        const put = await fetch(apiBase, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: payload.message || `admin: publish ${relPath}`,
            content: encoded,
            branch,
            ...(sha ? { sha } : {}),
          }),
        });
        if (!put.ok) {
          const errText = await put.text();
          return Response.json(
            { ok: false, error: 'github_write_failed', status: put.status, detail: errText.slice(0, 400) },
            { status: 502 },
          );
        }
        const result = (await put.json()) as { content?: { html_url?: string }; commit?: { html_url?: string } };
        return Response.json({
          ok: true,
          path: relPath,
          branch,
          url: result.content?.html_url || result.commit?.html_url || null,
        });
      }
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    if (url.pathname === '/api/report') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin, allow) });
      }
      if (request.method !== 'POST') {
        return new Response('Method not allowed', {
          status: 405,
          headers: corsHeaders(origin, allow),
        });
      }

      const action = env.GOOGLE_FORM_ACTION_URL;
      const entries = parseEntries(env.GOOGLE_FORM_ENTRIES);
      if (!action || !Object.keys(entries).length) {
        return Response.json(
          { ok: false, error: 'not_configured' },
          { status: 502, headers: corsHeaders(origin, allow) },
        );
      }

      if (env.REPORT_LIMIT) {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const { success } = await env.REPORT_LIMIT.limit({ key: ip });
        if (!success) {
          return Response.json(
            { ok: false, error: 'rate_limited' },
            { status: 429, headers: corsHeaders(origin, allow) },
          );
        }
      }

      let body: ReportBody;
      try {
        body = (await request.json()) as ReportBody;
      } catch {
        return Response.json(
          { ok: false, error: 'bad_json' },
          { status: 400, headers: corsHeaders(origin, allow) },
        );
      }

      if (typeof body.website === 'string' && body.website.trim() !== '') {
        return Response.json({ ok: true }, { status: 200, headers: corsHeaders(origin, allow) });
      }
      if (!body.id || typeof body.id !== 'string') {
        return Response.json(
          { ok: false, error: 'missing_id' },
          { status: 400, headers: corsHeaders(origin, allow) },
        );
      }

      const formBody = buildFormBody(body, entries);
      const upstream = await fetch(action, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
        redirect: 'follow',
      });
      // Google Forms often returns 200 HTML confirmation even on success.
      const ok = upstream.ok || upstream.status === 302;
      return Response.json(
        { ok, status: upstream.status },
        { status: ok ? 200 : 502, headers: corsHeaders(origin, allow) },
      );
    }

    return env.ASSETS.fetch(request);
  },
};

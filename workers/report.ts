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
  APP_ORIGIN?: string;
  REPORT_LIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
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
      const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
      const allowed = (env.ADMIN_EMAILS || 'godisourlord8874@gmail.com')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!email || !allowed.includes(email.toLowerCase())) {
        return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
      if (url.pathname === '/api/admin/me') {
        return Response.json({ ok: true, email, role: 'editor' });
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

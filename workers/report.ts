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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const allow = env.APP_ORIGIN || 'https://stuti.deepakmaseeh121.workers.dev';
    const origin = request.headers.get('Origin');

    if (url.pathname.startsWith('/api/admin')) {
      const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
      if (!email) {
        return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
      if (url.pathname === '/api/admin/me') {
        return Response.json({ ok: true, email, role: 'editor' });
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

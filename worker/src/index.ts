export interface Env {
  BIZDEX_API_KEY: string;
  RATE_LIMIT: KVNamespace;
  PROGRESS: KVNamespace;
  ENRICHMENT: KVNamespace;
  ALLOWED_ORIGINS: string;
}

const MAX_URLS_PER_REQUEST = 25;
const MAX_LOOKUPS_PER_DAY_PER_IP = 300;
const MAX_ENRICHMENT_BYTES = 8 * 1024 * 1024;
const BIZDEX_ENDPOINT = 'https://api.bizdex.app/external/research/person';

const DECISION_VALUES = new Set(['pending', 'approved', 'rejected', 'later']);
const SLUG_RE = /^[a-z0-9-]+$/;

interface ProgressState {
  totalRows: number;
  decisions: string[];
  updatedAt: string;
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin);
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allowed = origin && isAllowedOrigin(origin, allowedOrigins) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function checkAndConsumeRateLimit(env: Env, ip: string, count: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${ip}:${day}`;
  const current = Number((await env.RATE_LIMIT.get(key)) ?? '0');
  if (current + count > MAX_LOOKUPS_PER_DAY_PER_IP) return false;
  await env.RATE_LIMIT.put(key, String(current + count), { expirationTtl: 60 * 60 * 26 });
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
      return json({ error: 'Origin not allowed' }, 403, headers);
    }

    const url = new URL(request.url);
    const progressMatch = url.pathname.match(/^\/progress\/([^/]+)\/([^/]+)$/);
    if (progressMatch) {
      const [, account, list] = progressMatch;
      if (!SLUG_RE.test(account) || !SLUG_RE.test(list)) {
        return json({ error: 'Invalid account or list id' }, 400, headers);
      }
      const key = `progress:${account}:${list}`;

      if (request.method === 'GET') {
        const stored = await env.PROGRESS.get(key);
        if (!stored) return json({ totalRows: 0, decisions: [], updatedAt: null }, 200, headers);
        return json(JSON.parse(stored), 200, headers);
      }

      if (request.method === 'PUT') {
        let body: { totalRows?: unknown; decisions?: unknown };
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON body' }, 400, headers);
        }
        if (
          typeof body.totalRows !== 'number' ||
          !Array.isArray(body.decisions) ||
          !body.decisions.every((d) => typeof d === 'string' && DECISION_VALUES.has(d))
        ) {
          return json({ error: 'totalRows must be a number and decisions a string array of valid values' }, 400, headers);
        }
        const state: ProgressState = { totalRows: body.totalRows, decisions: body.decisions, updatedAt: new Date().toISOString() };
        await env.PROGRESS.put(key, JSON.stringify(state));
        return json(state, 200, headers);
      }

      return json({ error: 'Method not allowed' }, 405, headers);
    }

    const enrichmentMatch = url.pathname.match(/^\/enrichment\/([^/]+)\/([^/]+)$/);
    if (enrichmentMatch) {
      const [, account, list] = enrichmentMatch;
      if (!SLUG_RE.test(account) || !SLUG_RE.test(list)) {
        return json({ error: 'Invalid account or list id' }, 400, headers);
      }
      const key = `enrichment:${account}:${list}`;

      if (request.method === 'GET') {
        const stored = await env.ENRICHMENT.get(key);
        return json(stored ? JSON.parse(stored) : {}, 200, headers);
      }

      if (request.method === 'PUT') {
        const raw = await request.text();
        if (raw.length > MAX_ENRICHMENT_BYTES) {
          return json({ error: 'Enrichment payload too large' }, 413, headers);
        }
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: 'Invalid JSON body' }, 400, headers);
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return json({ error: 'Body must be a JSON object keyed by LinkedIn URL' }, 400, headers);
        }
        await env.ENRICHMENT.put(key, raw);
        return json({ ok: true }, 200, headers);
      }

      return json({ error: 'Method not allowed' }, 405, headers);
    }

    if (request.method !== 'POST' || url.pathname !== '/enrich') {
      return json({ error: 'Not found' }, 404, headers);
    }

    let body: { linkedinUrls?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, headers);
    }

    const linkedinUrls = body.linkedinUrls;
    if (!Array.isArray(linkedinUrls) || linkedinUrls.length === 0 || !linkedinUrls.every((u) => typeof u === 'string')) {
      return json({ error: 'linkedinUrls must be a non-empty array of strings' }, 400, headers);
    }
    if (linkedinUrls.length > MAX_URLS_PER_REQUEST) {
      return json({ error: `Max ${MAX_URLS_PER_REQUEST} linkedinUrls per request` }, 400, headers);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const withinLimit = await checkAndConsumeRateLimit(env, ip, linkedinUrls.length);
    if (!withinLimit) {
      return json({ error: 'Daily enrichment limit reached, try again tomorrow' }, 429, headers);
    }

    const bizdexResponse = await fetch(BIZDEX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.BIZDEX_API_KEY}`,
      },
      body: JSON.stringify({ linkedinUrls }),
    });

    const responseBody = await bizdexResponse.text();
    return new Response(responseBody, {
      status: bizdexResponse.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  },
};

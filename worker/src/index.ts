export interface Env {
  BIZDEX_API_KEY: string;
  RATE_LIMIT: KVNamespace;
  ALLOWED_ORIGINS: string;
}

const MAX_URLS_PER_REQUEST = 25;
const MAX_LOOKUPS_PER_DAY_PER_IP = 300;
const BIZDEX_ENDPOINT = 'https://api.bizdex.app/external/research/person';

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin);
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  const allowed = origin && isAllowedOrigin(origin, allowedOrigins) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (request.method !== 'POST' || new URL(request.url).pathname !== '/enrich') {
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

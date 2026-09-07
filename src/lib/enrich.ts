import type { ColumnMapping, CsvRow, EnrichmentMap, EnrichmentRecord } from '../types';
import { normalizeLinkedinUrl } from './linkedin';

const WORKER_URL = 'https://swipe-review-bizdex-proxy.sem-moreau.workers.dev/enrich';

export function collectLinkedinUrls(rows: CsvRow[], mapping: ColumnMapping): string[] {
  if (!mapping.linkedin) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    const raw = row[mapping.linkedin]?.trim();
    if (raw) seen.add(normalizeLinkedinUrl(raw));
  }
  return [...seen];
}

interface BizdexBatchResponse {
  results?: Array<EnrichmentRecord & { person?: { linkedinUrl?: string } }>;
  invalidLinkedinUrls?: string[];
}

export class RateLimitError extends Error {}

const REQUEST_TIMEOUT_MS = 45_000;

export async function enrichBatch(urls: string[]): Promise<EnrichmentMap> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedinUrls: urls }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Bizdex-verrijking duurde te lang (time-out)');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 429) throw new RateLimitError('Dagelijkse verrijkingslimiet bereikt');
  if (!res.ok) throw new Error(`Bizdex-verrijking mislukt (${res.status})`);

  const data = (await res.json()) as BizdexBatchResponse;
  const invalid = new Set((data.invalidLinkedinUrls ?? []).map(normalizeLinkedinUrl));
  const requested = urls.filter((u) => !invalid.has(u));
  const results = data.results ?? [];

  const out: EnrichmentMap = {};
  results.forEach((result, i) => {
    const url = result.person?.linkedinUrl ? normalizeLinkedinUrl(result.person.linkedinUrl) : requested[i];
    if (url) out[url] = result;
  });
  return out;
}

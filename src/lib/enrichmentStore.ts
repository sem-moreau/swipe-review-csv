import type { EnrichmentMap } from '../types';

const WORKER_BASE = 'https://swipe-review-bizdex-proxy.sem-moreau.workers.dev';

export async function fetchStoredEnrichment(accountId: string, listId: string): Promise<EnrichmentMap> {
  const res = await fetch(`${WORKER_BASE}/enrichment/${accountId}/${listId}`, { cache: 'no-store' });
  if (!res.ok) return {};
  return res.json();
}

export async function saveStoredEnrichment(accountId: string, listId: string, map: EnrichmentMap): Promise<void> {
  await fetch(`${WORKER_BASE}/enrichment/${accountId}/${listId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map),
  });
}

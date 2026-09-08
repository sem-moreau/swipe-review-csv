import type { Decision } from '../types';

const WORKER_BASE = 'https://swipe-review-bizdex-proxy.sem-moreau.workers.dev';

export interface ProgressState {
  totalRows: number;
  decisions: Decision[];
  updatedAt: string | null;
}

export async function fetchProgress(accountId: string, listId: string): Promise<ProgressState> {
  const res = await fetch(`${WORKER_BASE}/progress/${accountId}/${listId}`);
  if (!res.ok) throw new Error(`Kon voortgang niet ophalen (${res.status})`);
  return res.json();
}

export async function reportProgress(accountId: string, listId: string, totalRows: number, decisions: Decision[]): Promise<void> {
  await fetch(`${WORKER_BASE}/progress/${accountId}/${listId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalRows, decisions }),
  }).catch(() => {});
}

export function isComplete(state: ProgressState): boolean {
  return state.totalRows > 0 && state.decisions.length === state.totalRows && state.decisions.every((d) => d !== 'pending');
}

export function reviewedCount(state: ProgressState): number {
  return state.decisions.filter((d) => d !== 'pending').length;
}

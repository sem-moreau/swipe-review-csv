import { getFile, putFile } from './github';
import { parseCsvText } from './csv';
import { reportProgress } from './progress';
import type { Account } from './readyLists';

const MANIFEST_PATH = 'public/lists/manifest.json';

export interface ManifestData {
  accounts: Account[];
}

export async function getManifest(token: string): Promise<{ data: ManifestData; sha?: string }> {
  const file = await getFile(MANIFEST_PATH, token);
  if (!file) return { data: { accounts: [] }, sha: undefined };
  return { data: JSON.parse(file.content) as ManifestData, sha: file.sha };
}

async function ensureManifestEntry(
  accountId: string,
  accountName: string,
  listId: string,
  listLabel: string,
  token: string,
): Promise<void> {
  const { data, sha } = await getManifest(token);
  let account = data.accounts.find((a) => a.id === accountId);
  let changed = false;
  if (!account) {
    account = { id: accountId, name: accountName, lists: [] };
    data.accounts.push(account);
    changed = true;
  }
  if (!account.lists.find((l) => l.id === listId)) {
    account.lists.push({ id: listId, label: listLabel });
    changed = true;
  }
  if (!changed) return;
  await putFile(MANIFEST_PATH, JSON.stringify(data, null, 2) + '\n', `Admin: ${accountName} — ${listLabel} bijwerken in manifest`, token, sha);
}

/**
 * Publishes (creates or replaces) a CSV for one account/list: makes sure the manifest
 * knows about it, writes the CSV to the repo, and resets that list's tracked progress
 * so the swipe counters match the newly published rows instead of stale data.
 */
export async function publishCsv(
  accountId: string,
  accountName: string,
  listId: string,
  listLabel: string,
  csvText: string,
  token: string,
  onStep?: (message: string) => void,
): Promise<{ rowCount: number }> {
  onStep?.('Manifest bijwerken…');
  await ensureManifestEntry(accountId, accountName, listId, listLabel, token);

  onStep?.('CSV publiceren…');
  const csvPath = `public/lists/${accountId}/${listId}.csv`;
  const existing = await getFile(csvPath, token);
  await putFile(csvPath, csvText, `Admin: CSV bijwerken voor ${accountName} — ${listLabel}`, token, existing?.sha);

  const parsed = await parseCsvText(csvText, listLabel);
  onStep?.('Voortgang resetten…');
  await reportProgress(accountId, listId, parsed.rows.length, new Array(parsed.rows.length).fill('pending'));

  return { rowCount: parsed.rows.length };
}

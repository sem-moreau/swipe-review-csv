import { getFile, putFile } from './github';
import { parseCsvText } from './csv';
import { reportProgress } from './progress';
import type { Team } from './readyLists';

const MANIFEST_PATH = 'public/lists/manifest.json';

export interface ManifestData {
  teams: Team[];
}

export async function getManifest(token: string): Promise<{ data: ManifestData; sha?: string }> {
  const file = await getFile(MANIFEST_PATH, token);
  if (!file) return { data: { teams: [] }, sha: undefined };
  return { data: JSON.parse(file.content) as ManifestData, sha: file.sha };
}

function findTeam(data: ManifestData, teamId: string): Team {
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`Team "${teamId}" bestaat niet (meer) in het manifest.`);
  return team;
}

async function ensureManifestEntry(
  teamId: string,
  accountId: string,
  accountName: string,
  listId: string,
  listLabel: string,
  token: string,
): Promise<void> {
  const { data, sha } = await getManifest(token);
  const team = findTeam(data, teamId);
  let account = team.accounts.find((a) => a.id === accountId);
  let changed = false;
  if (!account) {
    account = { id: accountId, name: accountName, lists: [] };
    team.accounts.push(account);
    changed = true;
  }
  if (!account.lists.find((l) => l.id === listId)) {
    account.lists.push({ id: listId, label: listLabel });
    changed = true;
  }
  if (!changed) return;
  await putFile(
    MANIFEST_PATH,
    JSON.stringify(data, null, 2) + '\n',
    `Admin: ${team.name} — ${accountName} — ${listLabel} bijwerken in manifest`,
    token,
    sha,
  );
}

/**
 * Publishes (creates or replaces) a CSV for one account/list: makes sure the manifest
 * knows about it, writes the CSV to the repo, and resets that list's tracked progress
 * so the swipe counters match the newly published rows instead of stale data.
 */
export async function publishCsv(
  teamId: string,
  accountId: string,
  accountName: string,
  listId: string,
  listLabel: string,
  csvText: string,
  token: string,
  onStep?: (message: string) => void,
): Promise<{ rowCount: number }> {
  onStep?.('Manifest bijwerken…');
  await ensureManifestEntry(teamId, accountId, accountName, listId, listLabel, token);

  onStep?.('CSV publiceren…');
  const csvPath = `public/lists/${accountId}/${listId}.csv`;
  const existing = await getFile(csvPath, token);
  await putFile(csvPath, csvText, `Admin: CSV bijwerken voor ${accountName} — ${listLabel}`, token, existing?.sha);

  const parsed = await parseCsvText(csvText, listLabel);
  onStep?.('Voortgang resetten…');
  await reportProgress(accountId, listId, parsed.rows.length, new Array(parsed.rows.length).fill('pending'));

  return { rowCount: parsed.rows.length };
}

/** Creates a new, empty team. Fails quietly (no-op) if the id is already taken. */
export async function createTeam(teamId: string, teamName: string, password: string | undefined, token: string): Promise<void> {
  const { data, sha } = await getManifest(token);
  if (data.teams.find((t) => t.id === teamId)) return;
  data.teams.push({ id: teamId, name: teamName, ...(password ? { password } : {}), accounts: [] });
  await putFile(MANIFEST_PATH, JSON.stringify(data, null, 2) + '\n', `Admin: team "${teamName}" aanmaken`, token, sha);
}

/** Shows or hides one list's button for one account on the public site, without touching its data. */
export async function setListVisibility(
  teamId: string,
  accountId: string,
  listId: string,
  visible: boolean,
  token: string,
): Promise<void> {
  const { data, sha } = await getManifest(token);
  const team = findTeam(data, teamId);
  const account = team.accounts.find((a) => a.id === accountId);
  const list = account?.lists.find((l) => l.id === listId);
  if (!list || (list.visible ?? true) === visible) return;
  list.visible = visible;
  await putFile(
    MANIFEST_PATH,
    JSON.stringify(data, null, 2) + '\n',
    `Admin: "${list.label}" ${visible ? 'zichtbaar' : 'verborgen'} maken voor ${account!.name}`,
    token,
    sha,
  );
}

/** Archives a list: it drops off the public picker but stays in the manifest/CSV for history. */
export async function setListCompleted(
  teamId: string,
  accountId: string,
  listId: string,
  completed: boolean,
  token: string,
): Promise<void> {
  const { data, sha } = await getManifest(token);
  const team = findTeam(data, teamId);
  const account = team.accounts.find((a) => a.id === accountId);
  const list = account?.lists.find((l) => l.id === listId);
  if (!list || (list.completed ?? false) === completed) return;
  list.completed = completed;
  await putFile(
    MANIFEST_PATH,
    JSON.stringify(data, null, 2) + '\n',
    `Admin: "${list.label}" ${completed ? 'archiveren' : 'heropenen'} voor ${account!.name}`,
    token,
    sha,
  );
}

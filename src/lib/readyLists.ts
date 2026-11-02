export interface ReadyList {
  id: string;
  label: string;
  // Absent/true means visible — keeps existing manifests (written before this field existed) working as-is.
  visible?: boolean;
  // A list that's been checked off as done. Stays in the manifest/admin view for history,
  // but drops off the public picker regardless of `visible`.
  completed?: boolean;
}

export interface Account {
  id: string;
  name: string;
  lists: ReadyList[];
}

export interface Team {
  id: string;
  name: string;
  // Absent means anyone can open the team without a prompt. This is a soft gate only —
  // the manifest (passwords included) ships to the browser, it just keeps one team's
  // lists from showing up by accident while someone else's team is open.
  password?: string;
  accounts: Account[];
}

interface Manifest {
  teams: Team[];
}

export function listFileUrl(accountId: string, listId: string): string {
  return `${import.meta.env.BASE_URL}lists/${accountId}/${listId}.csv`;
}

export async function loadTeams(): Promise<Team[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}lists/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Kon manifest.json niet laden (${res.status})`);
  const data = (await res.json()) as Manifest;
  return data.teams;
}

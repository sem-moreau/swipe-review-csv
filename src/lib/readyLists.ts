export interface ReadyList {
  id: string;
  label: string;
}

export interface Account {
  id: string;
  name: string;
  lists: ReadyList[];
  // Absent/true means visible — keeps existing manifests (written before this field existed) working as-is.
  visible?: boolean;
}

interface Manifest {
  accounts: Account[];
}

export function listFileUrl(accountId: string, listId: string): string {
  return `${import.meta.env.BASE_URL}lists/${accountId}/${listId}.csv`;
}

export async function loadAccounts(): Promise<Account[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}lists/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Kon manifest.json niet laden (${res.status})`);
  const data = (await res.json()) as Manifest;
  return data.accounts;
}

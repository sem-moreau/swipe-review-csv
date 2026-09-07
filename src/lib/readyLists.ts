export interface ReadyList {
  id: string;
  label: string;
  file: string;
}

export interface Account {
  id: string;
  name: string;
  lists: ReadyList[];
}

const FUNNELS: Omit<ReadyList, 'file'>[] = [
  { id: 'novanext-vip-2027', label: 'NovaNext VIP 2027' },
  { id: 'fw-ap-fundraising', label: 'FW/AP Fundraising' },
];

function accountLists(accountId: string): ReadyList[] {
  return FUNNELS.map((f) => ({ ...f, file: `${import.meta.env.BASE_URL}lists/${accountId}/${f.id}.csv` }));
}

export const ACCOUNTS: Account[] = [
  { id: 'kauan', name: 'Kauan', lists: accountLists('kauan') },
  { id: 'joey', name: 'Joey', lists: accountLists('joey') },
  { id: 'sem', name: 'Sem', lists: accountLists('sem') },
];

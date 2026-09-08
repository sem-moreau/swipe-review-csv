import { useEffect, useState } from 'react';
import { loadAccounts, listFileUrl } from '../lib/readyLists';
import type { Account } from '../lib/readyLists';
import { parseCsvText } from '../lib/csv';
import type { ParsedCsv } from '../lib/csv';

interface Props {
  onParsed: (parsed: ParsedCsv, source?: { accountId: string; listId: string }) => void;
}

export function AccountPicker({ onParsed }: Props) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [loadingListId, setLoadingListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts()
      .then((all) => setAccounts(all.filter((a) => a.visible ?? true)))
      .catch(() => setAccounts([]));
  }, []);

  const openAccount = accounts?.find((a) => a.id === openAccountId);

  const handlePickList = async (accountId: string, listId: string, listLabel: string) => {
    setError(null);
    setLoadingListId(listId);
    try {
      const res = await fetch(listFileUrl(accountId, listId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = await parseCsvText(text, listLabel);
      if (parsed.rows.length === 0) {
        setError(`"${listLabel}" bevat nog geen leads.`);
        return;
      }
      onParsed(parsed, { accountId, listId });
    } catch {
      setError(`Kon "${listLabel}" niet laden.`);
    } finally {
      setLoadingListId(null);
    }
  };

  if (!accounts || accounts.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Klaarstaande lijsten</p>

      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => {
              setError(null);
              setOpenAccountId((current) => (current === account.id ? null : account.id));
            }}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              openAccountId === account.id
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]'
            }`}
          >
            {account.name}
          </button>
        ))}
      </div>

      {openAccount && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          {openAccount.lists.map((list) => (
            <button
              key={list.id}
              onClick={() => handlePickList(openAccount.id, list.id, list.label)}
              disabled={loadingListId !== null}
              className="flex items-center justify-between rounded-xl bg-[color:var(--color-surface-raised)] px-4 py-3 text-left text-sm font-medium text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-accent)]/10 disabled:opacity-50"
            >
              <span>{list.label}</span>
              <span className="text-xs text-[color:var(--color-text-faint)]">
                {loadingListId === list.id ? 'Laden…' : `${openAccount.name} →`}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
          {error}
        </div>
      )}
    </div>
  );
}

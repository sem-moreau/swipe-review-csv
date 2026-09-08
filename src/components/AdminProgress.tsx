import { useEffect, useState } from 'react';
import { loadAccounts, listFileUrl } from '../lib/readyLists';
import type { Account } from '../lib/readyLists';
import { fetchProgress, isComplete, reviewedCount } from '../lib/progress';
import type { ProgressState } from '../lib/progress';
import { parseCsvText, buildExportCsv, downloadCsv } from '../lib/csv';

interface Row {
  accountId: string;
  accountName: string;
  listId: string;
  listLabel: string;
  state: ProgressState | null;
}

export function AdminProgress() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setRows(null);
    loadAccounts()
      .then(async (accounts: Account[]) => {
        const flat: Row[] = [];
        for (const account of accounts) {
          for (const list of account.lists) {
            flat.push({ accountId: account.id, accountName: account.name, listId: list.id, listLabel: list.label, state: null });
          }
        }
        const withState = await Promise.all(
          flat.map(async (row) => {
            try {
              return { ...row, state: await fetchProgress(row.accountId, row.listId) };
            } catch {
              return row;
            }
          }),
        );
        setRows(withState);
      })
      .catch(() => setRows([]));
  };

  useEffect(refresh, []);

  const handleDownload = async (row: Row) => {
    if (!row.state) return;
    const key = `${row.accountId}:${row.listId}`;
    setError(null);
    setDownloadingKey(key);
    try {
      const res = await fetch(listFileUrl(row.accountId, row.listId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = await parseCsvText(text, row.listLabel);
      const decisions = parsed.rows.map((_, i) => row.state!.decisions[i] ?? 'pending');
      const { csv, filename } = buildExportCsv(parsed.headers, parsed.rows, decisions, 'all');
      downloadCsv(csv, `${row.accountName}-${row.listLabel}-${filename}`);
    } catch {
      setError(`Kon "${row.listLabel}" (${row.accountName}) niet downloaden.`);
    } finally {
      setDownloadingKey(null);
    }
  };

  if (!rows) {
    return <p className="text-sm text-[color:var(--color-text-faint)]">Voortgang laden…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-[color:var(--color-text-faint)]">Geen profielen gevonden.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Voortgang per lijst</p>
        <button onClick={refresh} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
          Vernieuwen
        </button>
      </div>

      {rows.map((row) => {
        const key = `${row.accountId}:${row.listId}`;
        const total = row.state?.totalRows ?? 0;
        const reviewed = row.state ? reviewedCount(row.state) : 0;
        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
        const done = row.state ? isComplete(row.state) : false;
        const started = total > 0;

        return (
          <div key={key} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text)]">{row.accountName}</p>
                <p className="text-xs text-[color:var(--color-text-faint)]">{row.listLabel}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  done
                    ? 'bg-[color:var(--color-approve)]/15 text-[color:var(--color-approve)]'
                    : started
                      ? 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]'
                      : 'bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-faint)]'
                }`}
              >
                {done ? 'Voltooid' : started ? 'Bezig' : 'Nog niet gestart'}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-raised)]">
              <div
                className={`h-full rounded-full transition-all ${done ? 'bg-[color:var(--color-approve)]' : 'bg-[color:var(--color-accent)]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-[color:var(--color-text-faint)]">
                {total > 0 ? `${reviewed} / ${total} beoordeeld` : 'Nog geen leads geladen'}
              </p>
              <button
                onClick={() => handleDownload(row)}
                disabled={reviewed === 0 || downloadingKey === key}
                className="text-xs font-medium text-[color:var(--color-accent)] hover:underline disabled:cursor-not-allowed disabled:text-[color:var(--color-text-faint)] disabled:no-underline"
              >
                {downloadingKey === key ? 'Downloaden…' : 'Download CSV'}
              </button>
            </div>
          </div>
        );
      })}

      {error && (
        <div className="rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
          {error}
        </div>
      )}
    </div>
  );
}

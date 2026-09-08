import { useEffect, useRef, useState } from 'react';
import type { Account } from '../lib/readyLists';
import { getManifest, publishCsv } from '../lib/adminPublish';
import { getFile, slugify } from '../lib/github';
import { fetchProgress, isComplete, reviewedCount } from '../lib/progress';
import type { ProgressState } from '../lib/progress';
import { parseCsvText, buildExportCsv, downloadCsv } from '../lib/csv';

interface Props {
  token: string;
}

interface ListInfo {
  rowCount: number | null;
  progress: ProgressState | null;
  loading: boolean;
  error: string | null;
}

type Busy = { key: string; message: string } | null;

const infoKey = (accountId: string, listId: string) => `${accountId}:${listId}`;

export function AdminDashboard({ token }: Props) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, ListInfo>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const newListFileInput = useRef<HTMLInputElement>(null);

  const refreshManifest = () => {
    getManifest(token).then(({ data }) => setAccounts(data.accounts));
  };

  useEffect(refreshManifest, [token]);

  const loadListInfo = async (accountId: string, listId: string) => {
    const key = infoKey(accountId, listId);
    setInfo((prev) => ({ ...prev, [key]: { rowCount: null, progress: null, loading: true, error: null } }));
    try {
      const [csvFile, progress] = await Promise.all([getFile(`public/lists/${accountId}/${listId}.csv`, token), fetchProgress(accountId, listId)]);
      const rowCount = csvFile ? (await parseCsvText(csvFile.content, listId)).rows.length : 0;
      setInfo((prev) => ({ ...prev, [key]: { rowCount, progress, loading: false, error: null } }));
    } catch {
      setInfo((prev) => ({ ...prev, [key]: { rowCount: null, progress: null, loading: false, error: 'Kon status niet laden.' } }));
    }
  };

  const openAccount = (accountId: string) => {
    setError(null);
    setShowNewList(false);
    if (openAccountId === accountId) {
      setOpenAccountId(null);
      return;
    }
    setOpenAccountId(accountId);
    const account = accounts?.find((a) => a.id === accountId);
    account?.lists.forEach((l) => {
      if (!info[infoKey(accountId, l.id)]) void loadListInfo(accountId, l.id);
    });
  };

  const account = accounts?.find((a) => a.id === openAccountId);

  const handleUploadNewList = async (accountId: string, accountName: string, file: File) => {
    const listId = slugify(newListName);
    const listLabel = newListName.trim();
    if (!listId || !listLabel) {
      setError('Geef de nieuwe lijst een naam.');
      return;
    }
    const key = infoKey(accountId, listId);
    setError(null);
    setBusy({ key, message: 'CSV lezen…' });
    try {
      const csvText = await file.text();
      await publishCsv(accountId, accountName, listId, listLabel, csvText, token, (m) => setBusy({ key, message: m }));
      setNewListName('');
      setShowNewList(false);
      refreshManifest();
      void loadListInfo(accountId, listId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publiceren mislukt.');
    } finally {
      setBusy(null);
    }
  };

  const handleReplaceList = async (accountId: string, accountName: string, listId: string, listLabel: string, file: File) => {
    const key = infoKey(accountId, listId);
    setError(null);
    setBusy({ key, message: 'CSV lezen…' });
    try {
      const csvText = await file.text();
      await publishCsv(accountId, accountName, listId, listLabel, csvText, token, (m) => setBusy({ key, message: m }));
      void loadListInfo(accountId, listId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publiceren mislukt.');
    } finally {
      setBusy(null);
      const input = fileInputs.current[key];
      if (input) input.value = '';
    }
  };

  const handleCreateAccount = () => {
    const id = slugify(newAccountName);
    if (!id) {
      setError('Geef het nieuwe profiel een naam.');
      return;
    }
    setShowNewAccount(false);
    setOpenAccountId(id);
    setAccounts((prev) => [...(prev ?? []), { id, name: newAccountName.trim(), lists: [] }]);
    setNewAccountName('');
    setShowNewList(true);
  };

  const handleDownload = async (accountId: string, accountName: string, listId: string, listLabel: string, mode: 'all' | 'approved' | 'rejected') => {
    const key = infoKey(accountId, listId);
    setError(null);
    setBusy({ key: key + ':dl:' + mode, message: 'Downloaden…' });
    try {
      const csvFile = await getFile(`public/lists/${accountId}/${listId}.csv`, token);
      if (!csvFile) throw new Error('CSV niet gevonden');
      const parsed = await parseCsvText(csvFile.content, listLabel);
      const progress = await fetchProgress(accountId, listId);
      const decisions = parsed.rows.map((_, i) => progress.decisions[i] ?? 'pending');
      const { csv, filename } = buildExportCsv(parsed.headers, parsed.rows, decisions, mode);
      downloadCsv(csv, `${accountName}-${listLabel}-${filename}`);
    } catch {
      setError(`Kon "${listLabel}" (${accountName}) niet downloaden.`);
    } finally {
      setBusy(null);
    }
  };

  if (!accounts) {
    return <p className="text-sm text-[color:var(--color-text-faint)]">Laden…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => openAccount(a.id)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              openAccountId === a.id
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]'
            }`}
          >
            {a.name}
          </button>
        ))}
        <button
          onClick={() => {
            setShowNewAccount((v) => !v);
            setOpenAccountId(null);
          }}
          className="rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]"
        >
          + Nieuw profiel
        </button>
      </div>

      {showNewAccount && (
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <input
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Naam, bijv. Bjorn"
            className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
          />
          <button onClick={handleCreateAccount} className="rounded-lg bg-[color:var(--color-accent)] px-3 py-2 text-sm font-semibold text-white">
            Aanmaken
          </button>
        </div>
      )}

      {account && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          {account.lists.length === 0 && (
            <p className="px-1 py-2 text-sm text-[color:var(--color-text-faint)]">Nog geen lijsten voor {account.name}.</p>
          )}

          {account.lists.map((list) => {
            const key = infoKey(account.id, list.id);
            const li = info[key];
            const prepared = (li?.rowCount ?? 0) > 0;
            const reviewed = li?.progress ? reviewedCount(li.progress) : 0;
            const total = li?.rowCount ?? 0;
            const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
            const done = li?.progress ? isComplete({ ...li.progress, totalRows: total }) : false;
            const isBusyHere = busy?.key === key;

            return (
              <div key={key} className="rounded-xl bg-[color:var(--color-surface-raised)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">{list.label}</p>
                  {li?.loading ? (
                    <span className="text-[11px] text-[color:var(--color-text-faint)]">Laden…</span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        !prepared
                          ? 'bg-[color:var(--color-reject)]/15 text-[color:var(--color-reject)]'
                          : done
                            ? 'bg-[color:var(--color-approve)]/15 text-[color:var(--color-approve)]'
                            : 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]'
                      }`}
                    >
                      {!prepared ? 'Nog niet klaargezet' : done ? 'Voltooid' : 'Klaargezet'}
                    </span>
                  )}
                </div>

                {prepared && (
                  <>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
                      <div
                        className={`h-full rounded-full transition-all ${done ? 'bg-[color:var(--color-approve)]' : 'bg-[color:var(--color-accent)]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--color-text-faint)]">{reviewed} / {total} beoordeeld</p>
                  </>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      fileInputs.current[key] = el;
                    }}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleReplaceList(account.id, account.name, list.id, list.label, file);
                    }}
                  />
                  <button
                    onClick={() => fileInputs.current[key]?.click()}
                    disabled={busy !== null}
                    className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] hover:border-[color:var(--color-accent)] disabled:opacity-50"
                  >
                    {isBusyHere ? busy!.message : prepared ? 'CSV vervangen' : 'CSV toevoegen'}
                  </button>
                  {prepared && (
                    <>
                      <button
                        onClick={() => handleDownload(account.id, account.name, list.id, list.label, 'all')}
                        disabled={busy !== null || reviewed === 0}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[color:var(--color-accent)] hover:underline disabled:text-[color:var(--color-text-faint)] disabled:no-underline"
                      >
                        Alles
                      </button>
                      <button
                        onClick={() => handleDownload(account.id, account.name, list.id, list.label, 'approved')}
                        disabled={busy !== null || reviewed === 0}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[color:var(--color-approve)] hover:underline disabled:text-[color:var(--color-text-faint)] disabled:no-underline"
                      >
                        Goedgekeurd
                      </button>
                      <button
                        onClick={() => handleDownload(account.id, account.name, list.id, list.label, 'rejected')}
                        disabled={busy !== null || reviewed === 0}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[color:var(--color-reject)] hover:underline disabled:text-[color:var(--color-text-faint)] disabled:no-underline"
                      >
                        Afgekeurd
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {!showNewList ? (
            <button
              onClick={() => setShowNewList(true)}
              className="rounded-xl border border-dashed border-[color:var(--color-border)] px-3.5 py-2.5 text-left text-sm font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]"
            >
              + Nieuwe lijst toevoegen voor {account.name}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] p-3">
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Naam van de lijst, bijv. Q1 Outreach"
                className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              />
              <input
                ref={newListFileInput}
                type="file"
                accept=".csv,text/csv"
                className="text-xs text-[color:var(--color-text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--color-accent)]/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[color:var(--color-accent)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const file = newListFileInput.current?.files?.[0];
                    if (!file) {
                      setError('Kies eerst een CSV-bestand.');
                      return;
                    }
                    void handleUploadNewList(account.id, account.name, file);
                  }}
                  disabled={busy !== null}
                  className="rounded-lg bg-[color:var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy?.key === infoKey(account.id, slugify(newListName)) ? busy.message : 'Publiceren'}
                </button>
                <button
                  onClick={() => setShowNewList(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-text-faint)]"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
          {error}
        </div>
      )}
    </div>
  );
}

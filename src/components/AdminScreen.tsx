import { useEffect, useRef, useState } from 'react';
import { loadAccounts } from '../lib/readyLists';
import type { Account } from '../lib/readyLists';
import { getToken, setToken, clearToken, verifyToken, getFile, putFile, slugify } from '../lib/github';
import { AdminProgress } from './AdminProgress';

interface Props {
  onClose: () => void;
}

type Status = { kind: 'idle' } | { kind: 'busy'; message: string } | { kind: 'error'; message: string } | { kind: 'success'; message: string };
type Tab = 'publish' | 'progress';

export function AdminScreen({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('publish');
  const [tokenInput, setTokenInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [accountChoice, setAccountChoice] = useState<string>('__new__');
  const [newAccountName, setNewAccountName] = useState('');
  const [listChoice, setListChoice] = useState<string>('__new__');
  const [newListLabel, setNewListLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const existing = getToken();
    if (!existing) {
      setCheckingToken(false);
      return;
    }
    verifyToken(existing)
      .then((ok) => setAuthed(ok))
      .finally(() => setCheckingToken(false));
  }, []);

  useEffect(() => {
    if (authed) loadAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [authed]);

  const handleTokenSubmit = async () => {
    const token = tokenInput.trim();
    if (!token) return;
    setStatus({ kind: 'busy', message: 'Token controleren…' });
    const ok = await verifyToken(token);
    if (!ok) {
      setStatus({ kind: 'error', message: 'Dit token werkt niet. Controleer of het toegang heeft tot deze repository (Contents: read & write).' });
      return;
    }
    setToken(token);
    setAuthed(true);
    setStatus({ kind: 'idle' });
  };

  const selectedAccount = accounts.find((a) => a.id === accountChoice);

  const handlePublish = async () => {
    if (!file) {
      setStatus({ kind: 'error', message: 'Kies eerst een CSV-bestand.' });
      return;
    }
    const accountId = accountChoice === '__new__' ? slugify(newAccountName) : accountChoice;
    const accountName = accountChoice === '__new__' ? newAccountName.trim() : (selectedAccount?.name ?? accountChoice);
    if (!accountId || !accountName) {
      setStatus({ kind: 'error', message: 'Geef een naam voor het nieuwe profiel op.' });
      return;
    }
    const listId = listChoice === '__new__' ? slugify(newListLabel) : listChoice;
    const listLabel = listChoice === '__new__' ? newListLabel.trim() : (selectedAccount?.lists.find((l) => l.id === listChoice)?.label ?? listChoice);
    if (!listId || !listLabel) {
      setStatus({ kind: 'error', message: 'Geef een naam voor de lijst op.' });
      return;
    }

    const token = getToken();
    try {
      setStatus({ kind: 'busy', message: 'CSV lezen…' });
      const csvText = await file.text();

      setStatus({ kind: 'busy', message: 'Manifest ophalen…' });
      const manifestPath = 'public/lists/manifest.json';
      const manifestFile = await getFile(manifestPath, token);
      const manifest = manifestFile ? JSON.parse(manifestFile.content) : { accounts: [] };
      const accountsList: Account[] = manifest.accounts ?? [];

      let account = accountsList.find((a) => a.id === accountId);
      if (!account) {
        account = { id: accountId, name: accountName, lists: [] };
        accountsList.push(account);
      }
      if (!account.lists.find((l) => l.id === listId)) {
        account.lists.push({ id: listId, label: listLabel });
      }

      setStatus({ kind: 'busy', message: 'Manifest bijwerken…' });
      await putFile(
        manifestPath,
        JSON.stringify({ accounts: accountsList }, null, 2) + '\n',
        `Admin: ${accountName} — ${listLabel} toevoegen aan manifest`,
        token,
        manifestFile?.sha,
      );

      setStatus({ kind: 'busy', message: 'CSV publiceren…' });
      const csvPath = `public/lists/${accountId}/${listId}.csv`;
      const existingCsv = await getFile(csvPath, token);
      await putFile(csvPath, csvText, `Admin: CSV bijwerken voor ${accountName} — ${listLabel}`, token, existingCsv?.sha);

      setStatus({ kind: 'success', message: `Gepubliceerd. Staat over ~30-60s live voor "${accountName}" → "${listLabel}".` });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadAccounts().then(setAccounts).catch(() => {});
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Onbekende fout.' });
    }
  };

  if (checkingToken) {
    return <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--color-text-faint)]">Laden…</div>;
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[color:var(--color-text)]">Admin</h1>
          <button onClick={onClose} className="text-sm font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]">
            ← Terug
          </button>
        </div>

        {!authed ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-[color:var(--color-text-muted)]">
              Plak een GitHub Personal Access Token met <strong>Contents: read &amp; write</strong> toegang tot deze repository
              (<code className="text-[13px]">sem-moreau/swipe-review-csv</code>). Het token wordt alleen lokaal in jouw browser bewaard.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="github_pat_..."
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            />
            <button
              onClick={handleTokenSubmit}
              disabled={status.kind === 'busy'}
              className="rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {status.kind === 'busy' ? status.message : 'Opslaan'}
            </button>
            {status.kind === 'error' && (
              <div className="rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
                {status.message}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-xs text-[color:var(--color-text-faint)]">
              <span>Ingelogd met GitHub-token</span>
              <button
                onClick={() => {
                  clearToken();
                  setAuthed(false);
                }}
                className="font-medium text-[color:var(--color-reject)] hover:underline"
              >
                Uitloggen
              </button>
            </div>

            <div className="flex gap-1 rounded-xl bg-[color:var(--color-surface)] p-1">
              <button
                onClick={() => setTab('publish')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === 'publish' ? 'bg-[color:var(--color-accent)] text-white' : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                Publiceren
              </button>
              <button
                onClick={() => setTab('progress')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === 'progress' ? 'bg-[color:var(--color-accent)] text-white' : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                Voortgang
              </button>
            </div>

            {tab === 'progress' && <AdminProgress />}

            {tab === 'publish' && (
              <>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Profiel</label>
              <select
                value={accountChoice}
                onChange={(e) => {
                  setAccountChoice(e.target.value);
                  setListChoice('__new__');
                }}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              >
                <option value="__new__">+ Nieuw profiel…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {accountChoice === '__new__' && (
                <input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Naam, bijv. Bjorn"
                  className="mt-2 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Lijst</label>
              <select
                value={listChoice}
                onChange={(e) => setListChoice(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              >
                <option value="__new__">+ Nieuwe lijst…</option>
                {selectedAccount?.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              {listChoice === '__new__' && (
                <input
                  value={newListLabel}
                  onChange={(e) => setNewListLabel(e.target.value)}
                  placeholder="Naam, bijv. Q1 Outreach"
                  className="mt-2 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              )}
              {listChoice !== '__new__' && (
                <p className="mt-1.5 text-[11px] text-[color:var(--color-text-faint)]">Bestaande CSV voor deze lijst wordt overschreven.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">CSV-bestand</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2.5 text-sm text-[color:var(--color-text)] file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--color-accent)]/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[color:var(--color-accent)]"
              />
            </div>

            <button
              onClick={handlePublish}
              disabled={status.kind === 'busy'}
              className="rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {status.kind === 'busy' ? status.message : 'Publiceren'}
            </button>

            {status.kind === 'error' && (
              <div className="rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
                {status.message}
              </div>
            )}
            {status.kind === 'success' && (
              <div className="rounded-xl border border-[color:var(--color-approve)]/30 bg-[color:var(--color-approve)]/10 px-4 py-3 text-sm text-[color:var(--color-approve)]">
                {status.message}
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

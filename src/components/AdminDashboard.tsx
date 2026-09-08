import { useEffect, useRef, useState } from 'react';
import type { Account } from '../lib/readyLists';
import { getManifest, publishCsv, setListVisibility } from '../lib/adminPublish';
import { getFile, slugify } from '../lib/github';
import { fetchProgress, isComplete, reviewedCount } from '../lib/progress';
import type { ProgressState } from '../lib/progress';
import { parseCsvText, buildExportCsv, downloadCsv } from '../lib/csv';
import { autoDetectMapping } from '../lib/fieldDetection';
import { collectLinkedinUrls, enrichBatch, RateLimitError } from '../lib/enrich';
import { fetchStoredEnrichment, saveStoredEnrichment } from '../lib/enrichmentStore';
import type { EnrichmentMap } from '../types';

const ENRICH_CONCURRENCY = 4;
const ENRICH_SAVE_EVERY = 5;

interface Props {
  token: string;
}

interface ListInfo {
  rowCount: number | null;
  linkedinCount: number | null;
  enrichedCount: number | null;
  progress: ProgressState | null;
  loading: boolean;
  error: string | null;
}

type Busy = { key: string; message: string } | null;
type Enriching = { key: string; done: number; total: number; failed: number; rateLimited: boolean } | null;

const infoKey = (accountId: string, listId: string) => `${accountId}:${listId}`;

export function AdminDashboard({ token }: Props) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, ListInfo>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [enriching, setEnriching] = useState<Enriching>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setInfo((prev) => ({
      ...prev,
      [key]: { rowCount: null, linkedinCount: null, enrichedCount: null, progress: null, loading: true, error: null },
    }));
    try {
      const [csvFile, progress, stored] = await Promise.all([
        getFile(`public/lists/${accountId}/${listId}.csv`, token),
        fetchProgress(accountId, listId),
        fetchStoredEnrichment(accountId, listId),
      ]);
      const parsed = csvFile ? await parseCsvText(csvFile.content, listId) : { headers: [], rows: [] };
      const mapping = autoDetectMapping(parsed.headers, parsed.rows);
      const linkedinUrls = collectLinkedinUrls(parsed.rows, mapping);
      const enrichedCount = linkedinUrls.filter((u) => stored[u]).length;
      setInfo((prev) => ({
        ...prev,
        [key]: { rowCount: parsed.rows.length, linkedinCount: linkedinUrls.length, enrichedCount, progress, loading: false, error: null },
      }));
    } catch {
      setInfo((prev) => ({
        ...prev,
        [key]: { rowCount: null, linkedinCount: null, enrichedCount: null, progress: null, loading: false, error: 'Kon status niet laden.' },
      }));
    }
  };

  const openAccount = (accountId: string) => {
    setError(null);
    setSuccess(null);
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
    setSuccess(null);
    setBusy({ key, message: 'CSV lezen…' });
    try {
      const csvText = await file.text();
      const { rowCount } = await publishCsv(accountId, accountName, listId, listLabel, csvText, token, (m) => setBusy({ key, message: m }));
      setNewListName('');
      setShowNewList(false);
      refreshManifest();
      void loadListInfo(accountId, listId);
      setSuccess(`"${listLabel}" gepubliceerd voor ${accountName} — ${rowCount} leads. Staat over ~30-60s live.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publiceren mislukt.');
    } finally {
      setBusy(null);
    }
  };

  const handleReplaceList = async (accountId: string, accountName: string, listId: string, listLabel: string, file: File) => {
    const key = infoKey(accountId, listId);
    setError(null);
    setSuccess(null);
    setBusy({ key, message: 'CSV lezen…' });
    try {
      const csvText = await file.text();
      const { rowCount } = await publishCsv(accountId, accountName, listId, listLabel, csvText, token, (m) => setBusy({ key, message: m }));
      void loadListInfo(accountId, listId);
      setSuccess(`"${listLabel}" bijgewerkt voor ${accountName} — ${rowCount} leads. Staat over ~30-60s live.`);
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

  const handleToggleListVisibility = async (accountId: string, listId: string, currentlyVisible: boolean) => {
    setError(null);
    const patch = (a: Account) =>
      a.id === accountId ? { ...a, lists: a.lists.map((l) => (l.id === listId ? { ...l, visible: !currentlyVisible } : l)) } : a;
    setAccounts((prev) => prev?.map(patch) ?? prev);
    try {
      await setListVisibility(accountId, listId, !currentlyVisible, token);
    } catch (err) {
      // Roll back the optimistic update if the write failed.
      const revert = (a: Account) =>
        a.id === accountId ? { ...a, lists: a.lists.map((l) => (l.id === listId ? { ...l, visible: currentlyVisible } : l)) } : a;
      setAccounts((prev) => prev?.map(revert) ?? prev);
      setError(err instanceof Error ? err.message : 'Zichtbaarheid wijzigen mislukt.');
    }
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

  const handleEnrichList = async (accountId: string, listId: string, listLabel: string) => {
    const key = infoKey(accountId, listId);
    setError(null);
    setSuccess(null);
    setEnriching({ key, done: 0, total: 0, failed: 0, rateLimited: false });
    try {
      const csvFile = await getFile(`public/lists/${accountId}/${listId}.csv`, token);
      if (!csvFile) throw new Error('CSV niet gevonden');
      const parsed = await parseCsvText(csvFile.content, listId);
      const mapping = autoDetectMapping(parsed.headers, parsed.rows);
      const existing = await fetchStoredEnrichment(accountId, listId);

      const allUrls = collectLinkedinUrls(parsed.rows, mapping);
      const todo = allUrls.filter((u) => !existing[u]);
      setEnriching({ key, done: 0, total: todo.length, failed: 0, rateLimited: false });

      if (todo.length === 0) {
        setSuccess(`"${listLabel}" was al volledig verrijkt (${allUrls.length} profielen).`);
        setEnriching(null);
        return;
      }

      const merged: EnrichmentMap = { ...existing };
      let failedCount = 0;
      let stopped = false;
      let rateLimitedFlag = false;
      let doneCount = 0;
      let nextIndex = 0;

      const worker = async () => {
        while (!stopped) {
          const i = nextIndex++;
          if (i >= todo.length) return;
          try {
            const result = await enrichBatch([todo[i]]);
            Object.assign(merged, result);
          } catch (err) {
            if (err instanceof RateLimitError) {
              stopped = true;
              rateLimitedFlag = true;
              setEnriching((prev) => (prev ? { ...prev, rateLimited: true } : prev));
              break;
            }
            failedCount += 1;
          }
          doneCount += 1;
          setEnriching({ key, done: doneCount, total: todo.length, failed: failedCount, rateLimited: rateLimitedFlag });

          // Save periodically instead of only at the very end: whoever opens this list
          // mid-run already sees the profiles done so far, and nothing is lost if the
          // run is interrupted (tab closed, network drop, rate limit).
          if (doneCount % ENRICH_SAVE_EVERY === 0) {
            await saveStoredEnrichment(accountId, listId, merged);
            void loadListInfo(accountId, listId);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(ENRICH_CONCURRENCY, todo.length) }, worker));
      await saveStoredEnrichment(accountId, listId, merged);
      void loadListInfo(accountId, listId);

      if (rateLimitedFlag) {
        setError(`Dagelijkse Bizdex-limiet bereikt tijdens "${listLabel}" — ${doneCount}/${todo.length} gelukt. Probeer de rest morgen opnieuw.`);
      } else if (failedCount > 0) {
        setSuccess(`"${listLabel}" verrijkt: ${doneCount - failedCount}/${todo.length} gelukt, ${failedCount} niet gevonden.`);
      } else {
        setSuccess(`"${listLabel}" volledig verrijkt met Bizdex (${doneCount} profielen).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verrijken mislukt.');
    } finally {
      setEnriching(null);
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
            const listVisible = list.visible ?? true;

            return (
              <div key={key} className={`rounded-xl bg-[color:var(--color-surface-raised)] p-3.5 ${listVisible ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">{list.label}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {li?.loading ? (
                      <span className="text-[11px] text-[color:var(--color-text-faint)]">Laden…</span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
                    <button
                      onClick={() => handleToggleListVisibility(account.id, list.id, listVisible)}
                      title={listVisible ? `Verbergen voor ${account.name}` : `Tonen voor ${account.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--color-text-faint)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
                    >
                      {listVisible ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.7 9.7 0 0112 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.2 6.2C4.3 7.5 2.9 9.3 2 12c1 3 5 7 10 7 1.3 0 2.5-.2 3.6-.6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {!listVisible && (
                  <p className="mt-1 text-[11px] text-[color:var(--color-text-faint)]">Verborgen voor {account.name} — staat niet op de startpagina.</p>
                )}

                {prepared && (
                  <>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
                      <div
                        className={`h-full rounded-full transition-all ${done ? 'bg-[color:var(--color-approve)]' : 'bg-[color:var(--color-accent)]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--color-text-faint)]">{reviewed} / {total} beoordeeld</p>

                    {li && li.linkedinCount !== null && li.linkedinCount > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[color:var(--color-text-faint)]">
                          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.44-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.11 20.45H3.56V9h3.55v11.45z" />
                        </svg>
                        <p className="text-xs text-[color:var(--color-text-faint)]">
                          {li.enrichedCount ?? 0} / {li.linkedinCount} verrijkt met Bizdex
                        </p>
                      </div>
                    )}
                    {enriching?.key === key && (
                      <div className="mt-2 rounded-lg bg-[color:var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] text-[color:var(--color-accent)]">
                        Verrijken… {enriching.done}/{enriching.total}
                        {enriching.failed > 0 ? ` (${enriching.failed} niet gevonden)` : ''}
                        {enriching.rateLimited ? ' — limiet bereikt' : ''}
                      </div>
                    )}
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
                  {prepared && li && li.linkedinCount !== null && li.linkedinCount > 0 && (
                    <button
                      onClick={() => handleEnrichList(account.id, list.id, list.label)}
                      disabled={enriching !== null || busy !== null}
                      className="rounded-lg border border-[color:var(--color-accent)]/40 px-3 py-1.5 text-xs font-medium text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 disabled:opacity-50"
                    >
                      {enriching?.key === key
                        ? 'Bezig…'
                        : (li.enrichedCount ?? 0) >= li.linkedinCount
                          ? 'Opnieuw verrijken'
                          : 'Verrijken met Bizdex'}
                    </button>
                  )}
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

      {success && (
        <div className="rounded-xl border border-[color:var(--color-approve)]/30 bg-[color:var(--color-approve)]/10 px-4 py-3 text-sm text-[color:var(--color-approve)]">
          {success}
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

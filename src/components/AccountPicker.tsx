import { useEffect, useState } from 'react';
import { loadTeams, listFileUrl } from '../lib/readyLists';
import type { Team, Account } from '../lib/readyLists';
import { parseCsvText } from '../lib/csv';
import type { ParsedCsv } from '../lib/csv';

interface Props {
  onParsed: (parsed: ParsedCsv, source?: { accountId: string; listId: string }) => void;
  trailingAction?: React.ReactNode;
}

const UNLOCKED_KEY = 'swipe-review-unlocked-teams';

function readUnlocked(): Set<string> {
  try {
    const raw = sessionStorage.getItem(UNLOCKED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberUnlocked(teamId: string): void {
  try {
    const next = readUnlocked();
    next.add(teamId);
    sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify([...next]));
  } catch {
    // Private browsing or full storage: the team just asks again next time.
  }
}

export function AccountPicker({ onParsed, trailingAction }: Props) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(() => readUnlocked());
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [loadingListId, setLoadingListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeams()
      .then((all) =>
        setTeams(
          all.map((t) => ({
            ...t,
            accounts: t.accounts
              .map((a) => ({ ...a, lists: a.lists.filter((l) => (l.visible ?? true) && !l.completed) }))
              .filter((a) => a.lists.length > 0),
          })),
        ),
      )
      .catch(() => setTeams([]));
  }, []);

  const openTeam = teams?.find((t) => t.id === openTeamId);
  const teamIsUnlocked = (team: Team) => !team.password || unlocked.has(team.id);
  const openAccount = openTeam?.accounts.find((a: Account) => a.id === openAccountId);
  const hasTeams = teams && teams.length > 0;

  const handlePickTeam = (team: Team) => {
    setError(null);
    setPasswordError(null);
    setPasswordDraft('');
    if (openTeamId === team.id) {
      setOpenTeamId(null);
      setOpenAccountId(null);
      return;
    }
    setOpenTeamId(team.id);
    setOpenAccountId(null);
  };

  const handleUnlock = (team: Team) => {
    if (passwordDraft.trim() === (team.password ?? '').trim()) {
      const next = new Set(unlocked);
      next.add(team.id);
      setUnlocked(next);
      rememberUnlocked(team.id);
      setPasswordError(null);
      setPasswordDraft('');
    } else {
      setPasswordError('Dat wachtwoord klopt niet.');
    }
  };

  const handlePickList = async (accountId: string, listId: string, listLabel: string) => {
    setError(null);
    setLoadingListId(listId);
    try {
      const res = await fetch(listFileUrl(accountId, listId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = await parseCsvText(text, listLabel);
      if (parsed.rows.length === 0) {
        setError(`"${listLabel}" doesn't have any leads yet.`);
        return;
      }
      onParsed(parsed, { accountId, listId });
    } catch {
      setError(`Couldn't load "${listLabel}".`);
    } finally {
      setLoadingListId(null);
    }
  };

  return (
    <div className="mb-6">
      {hasTeams && (
        <p className="mb-2.5 text-center text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-faint)]">Teams</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {teams?.map((team) => (
          <button
            key={team.id}
            onClick={() => handlePickTeam(team)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              openTeamId === team.id
                ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]'
            }`}
          >
            {team.name}
            {team.password && !unlocked.has(team.id) && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-1.5 inline-block align-[-1px] text-[color:var(--color-text-faint)]">
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ))}
        {trailingAction}
      </div>

      {openTeam && !teamIsUnlocked(openTeam) && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <p className="text-sm font-medium text-[color:var(--color-text)]">{openTeam.name} is vergrendeld.</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={passwordDraft}
              onChange={(e) => {
                setPasswordDraft(e.target.value);
                setPasswordError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock(openTeam);
              }}
              placeholder="Wachtwoord"
              autoFocus
              className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            />
            <button
              onClick={() => handleUnlock(openTeam)}
              className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Open
            </button>
          </div>
          {passwordError && <p className="text-xs text-[color:var(--color-reject)]">{passwordError}</p>}
        </div>
      )}

      {openTeam && teamIsUnlocked(openTeam) && openTeam.accounts.length === 0 && (
        <p className="mt-3 text-center text-sm text-[color:var(--color-text-faint)]">
          Nog geen lijsten voor {openTeam.name}.
        </p>
      )}

      {openTeam && teamIsUnlocked(openTeam) && openTeam.accounts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {openTeam.accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                setError(null);
                setOpenAccountId((current) => (current === account.id ? null : account.id));
              }}
              className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                openAccountId === account.id
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]'
              }`}
            >
              {account.name}
            </button>
          ))}
        </div>
      )}

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
                {loadingListId === list.id ? 'Loading…' : `${openAccount.name} →`}
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

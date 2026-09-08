import { useEffect, useState } from 'react';
import { getToken, setToken, clearToken, verifyToken } from '../lib/github';
import { AdminDashboard } from './AdminDashboard';

interface Props {
  onClose: () => void;
}

type Status = { kind: 'idle' } | { kind: 'busy'; message: string } | { kind: 'error'; message: string };

export function AdminScreen({ onClose }: Props) {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setActiveToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const existing = getToken();
    if (!existing) {
      setCheckingToken(false);
      return;
    }
    verifyToken(existing)
      .then((ok) => {
        if (ok) {
          setActiveToken(existing);
          setAuthed(true);
        }
      })
      .finally(() => setCheckingToken(false));
  }, []);

  const handleTokenSubmit = async () => {
    const value = tokenInput.trim();
    if (!value) return;
    setStatus({ kind: 'busy', message: 'Token controleren…' });
    const ok = await verifyToken(value);
    if (!ok) {
      setStatus({ kind: 'error', message: 'Dit token werkt niet. Controleer of het toegang heeft tot deze repository (Contents: read & write).' });
      return;
    }
    setToken(value);
    setActiveToken(value);
    setAuthed(true);
    setStatus({ kind: 'idle' });
  };

  return (
    <div className="flex flex-1 flex-col items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[color:var(--color-text)]">Admin</h1>
          <button onClick={onClose} className="text-sm font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]">
            ← Terug
          </button>
        </div>

        {checkingToken ? (
          <p className="text-sm text-[color:var(--color-text-faint)]">Laden…</p>
        ) : !authed ? (
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
                  setActiveToken('');
                }}
                className="font-medium text-[color:var(--color-reject)] hover:underline"
              >
                Uitloggen
              </button>
            </div>

            <AdminDashboard token={token} />
          </div>
        )}
      </div>
    </div>
  );
}

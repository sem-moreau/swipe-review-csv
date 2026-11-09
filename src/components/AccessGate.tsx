import { useState } from 'react';
import { SwipeBackdrop } from './SwipeBackdrop';

const SITE_PASSCODE = 'swipetool123';
const UNLOCKED_KEY = 'swipe-review-site-unlocked';

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, 'true');
  } catch {
    // Private browsing or full storage: it just asks again next time.
  }
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => readUnlocked());
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  const handleUnlock = () => {
    if (draft.trim() === SITE_PASSCODE) {
      rememberUnlocked();
      setUnlocked(true);
    } else {
      setError('Die code klopt niet.');
    }
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-10">
      <SwipeBackdrop />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
        <p className="text-sm font-medium text-[color:var(--color-text)]">Deze tool is vergrendeld.</p>
        <input
          type="password"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUnlock();
          }}
          placeholder="Toegangscode"
          autoFocus
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-center text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
        />
        <button
          onClick={handleUnlock}
          className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Open
        </button>
        {error && <p className="text-xs text-[color:var(--color-reject)]">{error}</p>}
      </div>
    </div>
  );
}

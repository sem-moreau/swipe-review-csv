import { useCallback, useRef, useState } from 'react';
import { parseFiles } from '../lib/csv';
import type { ParsedCsv } from '../lib/csv';
import { AccountPicker } from './AccountPicker';
import { SwipeBackdrop } from './SwipeBackdrop';

interface Props {
  onParsed: (parsed: ParsedCsv, source?: { accountId: string; listId: string }) => void;
  resumeBanner?: React.ReactNode;
  onOpenAdmin?: () => void;
}

export function UploadScreen({ onParsed, resumeBanner, onOpenAdmin }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.csv'));
      if (files.length === 0) {
        setError('No valid CSV file found. Choose a .csv file.');
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const parsed = await parseFiles(files);
        if (parsed.rows.length === 0) {
          setError('This file has no rows to review. Check that the CSV file contains data.');
          setBusy(false);
          return;
        }
        onParsed(parsed);
      } catch {
        setError('Could not read the file. Check that it is a valid CSV file.');
      } finally {
        setBusy(false);
      }
    },
    [onParsed],
  );

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-10">
      <SwipeBackdrop />

      {onOpenAdmin && (
        <button
          onClick={onOpenAdmin}
          className="fixed bottom-4 left-4 z-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-muted)]"
        >
          Admin
        </button>
      )}
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-3 flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}brand/more-ventures.png`}
            alt="More Ventures"
            className="h-28 w-auto"
          />

          <div className="mt-6 flex w-full items-center justify-between gap-6 border-t border-[color:var(--color-border)]/60 pt-5">
            <img
              src={`${import.meta.env.BASE_URL}brand/hypernova.png`}
              alt="Hypernova"
              className="h-8 w-auto opacity-80"
            />
            <img
              src={`${import.meta.env.BASE_URL}brand/earlybird.svg`}
              alt="Early Bird"
              className="h-6 w-auto opacity-80"
            />
          </div>
        </div>

        {resumeBanner}

        <h1 className="mb-2.5 text-center text-xs font-medium uppercase tracking-wide text-[color:var(--color-text)]">Swipe More</h1>

        <AccountPicker
          onParsed={onParsed}
          trailingAction={
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                isDragging
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path
                  d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {busy ? 'Processing…' : 'Import CSV'}
            </label>
          }
        />

        {error && (
          <div className="mt-3 rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
            {error}
          </div>
        )}

        <p className="mt-4 text-center text-xs leading-relaxed text-[color:var(--color-text-faint)]">
          Works with LinkedIn Sales Navigator exports, Apollo lists and generic CSVs. Nothing leaves your device.
        </p>
      </div>
    </div>
  );
}

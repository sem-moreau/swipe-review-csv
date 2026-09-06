import { useCallback, useRef, useState } from 'react';
import { parseFiles } from '../lib/csv';
import type { ParsedCsv } from '../lib/csv';

interface Props {
  onParsed: (parsed: ParsedCsv) => void;
  resumeBanner?: React.ReactNode;
}

export function UploadScreen({ onParsed, resumeBanner }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.csv'));
      if (files.length === 0) {
        setError('Geen geldig CSV-bestand gevonden. Kies een .csv-bestand.');
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const parsed = await parseFiles(files);
        if (parsed.rows.length === 0) {
          setError('Dit bestand bevat geen rijen om te beoordelen. Controleer of het CSV-bestand data bevat.');
          setBusy(false);
          return;
        }
        onParsed(parsed);
      } catch {
        setError('Kon het bestand niet lezen. Controleer of het een geldig CSV-bestand is.');
      } finally {
        setBusy(false);
      }
    },
    [onParsed],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--color-approve)] to-[color:var(--color-approve-strong)] shadow-lg shadow-emerald-500/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-text)]">Swipe Review</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
            Importeer je leadlijst en beoordeel elk record met een swipe. Alles blijft op je toestel.
          </p>
        </div>

        {resumeBanner}

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
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            isDragging
              ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10'
              : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-faint)]'
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
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mb-3 text-[color:var(--color-text-faint)]">
            <path
              d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[15px] font-medium text-[color:var(--color-text)]">
            {busy ? 'Bestand verwerken…' : 'Sleep je CSV hierheen'}
          </span>
          <span className="mt-1 text-sm text-[color:var(--color-text-faint)]">of tik om te kiezen — meerdere bestanden mag</span>
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
            {error}
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-[color:var(--color-text-faint)]">
          Werkt met LinkedIn Sales Navigator-exports, Apollo-lijsten en generieke CSV's. Niets verlaat je apparaat.
        </p>
      </div>
    </div>
  );
}

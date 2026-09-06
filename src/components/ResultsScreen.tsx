import type { CsvRow, Decision } from '../types';
import { buildExportCsv, downloadCsv } from '../lib/csv';

interface Props {
  headers: string[];
  rows: CsvRow[];
  decisions: Decision[];
  onStartOver: () => void;
  onUndo: () => void;
}

export function ResultsScreen({ headers, rows, decisions, onStartOver, onUndo }: Props) {
  const approved = decisions.filter((d) => d === 'approved').length;
  const rejected = decisions.filter((d) => d === 'rejected').length;
  const total = rows.length;

  const handleExport = (mode: 'approved' | 'rejected' | 'all') => {
    const { csv, filename } = buildExportCsv(headers, rows, decisions, mode);
    downloadCsv(csv, filename);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--color-approve)] to-[color:var(--color-approve-strong)] shadow-lg shadow-emerald-500/20">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[color:var(--color-text)]">Klaar met reviewen</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{total.toLocaleString('nl-NL')} records beoordeeld</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-4">
            <div className="text-2xl font-bold text-[color:var(--color-approve)]">{approved}</div>
            <div className="text-xs text-[color:var(--color-text-faint)]">goedgekeurd</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-4">
            <div className="text-2xl font-bold text-[color:var(--color-reject)]">{rejected}</div>
            <div className="text-xs text-[color:var(--color-text-faint)]">afgekeurd</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => handleExport('approved')}
            disabled={approved === 0}
            className="rounded-xl bg-[color:var(--color-approve-strong)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-[0.98] disabled:opacity-30"
          >
            Download goedgekeurd.csv ({approved})
          </button>
          <button
            onClick={() => handleExport('rejected')}
            disabled={rejected === 0}
            className="rounded-xl bg-[color:var(--color-reject-strong)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-transform active:scale-[0.98] disabled:opacity-30"
          >
            Download afgekeurd.csv ({rejected})
          </button>
          <button
            onClick={() => handleExport('all')}
            className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm font-medium text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-surface-raised)]"
          >
            Download alles (met statuskolom)
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button onClick={onUndo} className="text-xs font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]">
            ↺ Laatste beoordeling terugdraaien
          </button>
          <span className="text-[color:var(--color-border)]">·</span>
          <button onClick={onStartOver} className="text-xs font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]">
            Nieuwe lijst importeren
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { ColumnMapping, FieldKey } from '../types';
import { FIELD_LABELS, FIELD_ORDER } from '../types';

interface Props {
  headers: string[];
  initialMapping: ColumnMapping;
  rowCount: number;
  sampleRow: Record<string, string> | undefined;
  fileNames: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

const REQUIRED_HINT: FieldKey[] = ['name', 'company', 'title'];

export function ColumnMapper({ headers, initialMapping, rowCount, sampleRow, fileNames, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  const setField = (field: FieldKey, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value || undefined }));
  };

  const mappedCount = FIELD_ORDER.filter((f) => mapping[f]).length;

  return (
    <div className="flex flex-1 flex-col px-5 py-8 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-accent)]">
            {fileNames.length > 1 ? `${fileNames.length} bestanden` : fileNames[0]} · {rowCount.toLocaleString('nl-NL')} rijen
          </p>
          <h1 className="mt-1 text-xl font-semibold text-[color:var(--color-text)]">Koppel je kolommen</h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            We hebben {mappedCount}/{FIELD_ORDER.length} velden herkend. Corrigeer waar nodig.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {FIELD_ORDER.map((field) => {
            const value = mapping[field] ?? '';
            const preview = value ? sampleRow?.[value] : undefined;
            return (
              <div
                key={field}
                className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3"
              >
                <div className="w-[120px] shrink-0">
                  <div className="text-sm font-medium text-[color:var(--color-text)]">{FIELD_LABELS[field]}</div>
                  {REQUIRED_HINT.includes(field) && !value && (
                    <div className="text-[11px] text-[color:var(--color-text-faint)]">aanbevolen</div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <select
                    value={value}
                    onChange={(e) => setField(field, e.target.value)}
                    className="w-full appearance-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                  >
                    <option value="">— geen —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {preview !== undefined && preview !== '' && (
                    <div className="mt-1 truncate text-xs text-[color:var(--color-text-faint)]">bijv. "{preview}"</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-medium text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface)]"
          >
            Andere lijst
          </button>
          <button
            onClick={() => onConfirm(mapping)}
            className="flex-1 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-transform active:scale-[0.98]"
          >
            Start met reviewen →
          </button>
        </div>
      </div>
    </div>
  );
}

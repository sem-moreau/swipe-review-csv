import { useEffect, useRef, useState } from 'react';
import type { ColumnMapping, CsvRow, EnrichmentMap } from '../types';
import { collectLinkedinUrls, enrichBatch, RateLimitError } from '../lib/enrich';

const CONCURRENCY = 4;

interface Props {
  rows: CsvRow[];
  mapping: ColumnMapping;
  existingEnrichment: EnrichmentMap;
  onComplete: (enrichment: EnrichmentMap) => void;
  onSkip: () => void;
}

export function EnrichScreen({ rows, mapping, existingEnrichment, onComplete, onSkip }: Props) {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const urls = collectLinkedinUrls(rows, mapping).filter((u) => !existingEnrichment[u]);
    setTotal(urls.length);

    if (urls.length === 0) {
      onComplete(existingEnrichment);
      return;
    }

    (async () => {
      const merged: EnrichmentMap = { ...existingEnrichment };
      let failedCount = 0;
      let stopped = false;
      let nextIndex = 0;

      async function worker() {
        while (!stopped) {
          const i = nextIndex++;
          if (i >= urls.length) return;
          try {
            const result = await enrichBatch([urls[i]]);
            Object.assign(merged, result);
          } catch (err) {
            if (err instanceof RateLimitError) {
              stopped = true;
              setRateLimited(true);
              return;
            }
            failedCount += 1;
            setFailed(failedCount);
          }
          setDone((d) => d + 1);
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
      onComplete(merged);
    })();
  }, [rows, mapping, existingEnrichment, onComplete]);

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--color-accent)] to-[color:var(--color-accent-strong)] shadow-lg">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="animate-pulse text-white">
            <path
              d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"
              stroke="white"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[color:var(--color-text)]">Profielen verrijken met Bizdex…</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          {total === 0 ? 'Even checken welke profielen al bekend zijn…' : `${done} van ${total} LinkedIn-profielen verwerkt`}
        </p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-raised)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-approve)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {failed > 0 && (
          <p className="mt-4 text-xs text-[color:var(--color-text-faint)]">{failed} profielen konden niet verrijkt worden — die swipe je zonder extra data.</p>
        )}

        {rateLimited && (
          <p className="mt-4 rounded-xl border border-[color:var(--color-reject)]/30 bg-[color:var(--color-reject)]/10 px-4 py-3 text-sm text-[color:var(--color-reject)]">
            Dagelijkse verrijkingslimiet bereikt. De rest van de lijst wordt zonder verrijking getoond — probeer morgen opnieuw voor de rest.
          </p>
        )}

        <button
          onClick={onSkip}
          className="mt-6 text-xs font-medium text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]"
        >
          Overslaan en direct swipen →
        </button>
      </div>
    </div>
  );
}

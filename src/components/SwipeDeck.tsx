import { useCallback, useEffect, useRef } from 'react';
import type { ColumnMapping, CsvRow, Decision, EnrichmentMap } from '../types';
import { normalizeLinkedinUrl } from '../lib/linkedin';
import { SwipeCard } from './SwipeCard';
import type { SwipeCardHandle } from './SwipeCard';

interface Props {
  rows: CsvRow[];
  headers: string[];
  mapping: ColumnMapping;
  enrichment: EnrichmentMap;
  decisions: Decision[];
  currentIndex: number;
  onDecision: (direction: 'left' | 'right' | 'down') => void;
  onUndo: () => void;
  onEditMapping: () => void;
}

export function SwipeDeck({ rows, headers, mapping, enrichment, decisions, currentIndex, onDecision, onUndo, onEditMapping }: Props) {
  const topCardRef = useRef<SwipeCardHandle>(null);
  const isAnimating = useRef(false);

  const total = rows.length;
  const approved = decisions.filter((d) => d === 'approved').length;
  const rejected = decisions.filter((d) => d === 'rejected').length;
  const later = decisions.filter((d) => d === 'later').length;
  const reviewed = approved + rejected + later;

  // A card animates out over ~0.3s; ignore extra taps/keys until the next
  // card has actually mounted (currentIndex change), so rapid input can't
  // fire a second animate() on the same motion value and silently drop a swipe.
  useEffect(() => {
    isAnimating.current = false;
  }, [currentIndex]);

  const triggerSwipe = useCallback((direction: 'left' | 'right' | 'down') => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    topCardRef.current?.swipe(direction);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerSwipe('right');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggerSwipe('down');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerSwipe, onUndo]);

  const visibleIndices = [currentIndex, currentIndex + 1, currentIndex + 2].filter((i) => i < total);

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={onEditMapping}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-muted)]"
          >
            ← Kolommen
          </button>
          <div className="text-sm font-medium text-[color:var(--color-text-muted)]">
            {Math.min(reviewed + 1, total)} / {total}
          </div>
          <button
            onClick={onUndo}
            disabled={currentIndex === 0}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-muted)] disabled:opacity-30"
            title="Ongedaan maken (Cmd/Ctrl+Z)"
          >
            Ongedaan ↺
          </button>
        </div>

        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-raised)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-approve)] transition-[width] duration-300"
            style={{ width: `${total === 0 ? 0 : (reviewed / total) * 100}%` }}
          />
        </div>

        <div className="relative flex-1" style={{ minHeight: 420 }}>
          {visibleIndices
            .slice()
            .reverse()
            .map((rowIndex) => {
              const stackIndex = rowIndex - currentIndex;
              const linkedinRaw = mapping.linkedin ? rows[rowIndex][mapping.linkedin]?.trim() : undefined;
              const rowEnrichment = linkedinRaw ? enrichment[normalizeLinkedinUrl(linkedinRaw)] : undefined;
              return (
                <SwipeCard
                  key={rowIndex}
                  ref={stackIndex === 0 ? topCardRef : undefined}
                  row={rows[rowIndex]}
                  mapping={mapping}
                  headers={headers}
                  enrichment={rowEnrichment}
                  isTop={stackIndex === 0}
                  stackIndex={stackIndex}
                  onSwiped={onDecision}
                />
              );
            })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            onClick={() => triggerSwipe('left')}
            aria-label="Afkeuren"
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[color:var(--color-reject)]/40 bg-[color:var(--color-surface)] text-[color:var(--color-reject)] shadow-lg shadow-black/20 transition-transform active:scale-90"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => triggerSwipe('right')}
            aria-label="Goedkeuren"
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[color:var(--color-approve)]/40 bg-[color:var(--color-surface)] text-[color:var(--color-approve)] shadow-lg shadow-black/20 transition-transform active:scale-90"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => triggerSwipe('down')}
            aria-label="Nog een keer bekijken"
            title="Nog een keer bekijken"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[color:var(--color-text-faint)]/40 bg-[color:var(--color-surface)] text-[color:var(--color-text-faint)] shadow-lg shadow-black/20 transition-transform active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[color:var(--color-text-faint)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-reject)]" /> {rejected} afgekeurd
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-approve)]" /> {approved} goedgekeurd
          </span>
          {later > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-text-faint)]" /> {later} nog een keer
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

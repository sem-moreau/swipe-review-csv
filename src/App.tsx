import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnMapping, CsvRow, Decision, EnrichmentMap } from './types';
import type { ParsedCsv } from './lib/csv';
import { autoDetectMapping } from './lib/fieldDetection';
import { loadData, saveData, loadProgress, saveProgress, loadEnrichment, saveEnrichment, clearSession } from './lib/session';
import { UploadScreen } from './components/UploadScreen';
import { ColumnMapper } from './components/ColumnMapper';
import { EnrichScreen } from './components/EnrichScreen';
import { SwipeDeck } from './components/SwipeDeck';
import { ResultsScreen } from './components/ResultsScreen';

type Screen = 'loading' | 'upload' | 'mapping' | 'enrich' | 'review' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [enrichment, setEnrichment] = useState<EnrichmentMap>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const [data, progress, savedEnrichment] = await Promise.all([loadData(), loadProgress(), loadEnrichment()]);
      setEnrichment(savedEnrichment);
      if (data && data.rows.length > 0) {
        setFileNames(data.fileNames);
        setHeaders(data.headers);
        setRows(data.rows);
        if (progress) {
          setMapping(progress.mapping);
          setDecisions(progress.decisions);
          setCurrentIndex(progress.currentIndex);
          setScreen(progress.currentIndex >= data.rows.length ? 'results' : 'review');
        } else {
          setMapping(autoDetectMapping(data.headers));
          setScreen('mapping');
        }
      } else {
        setScreen('upload');
      }
      hydrated.current = true;
    })();
  }, []);

  // Persist progress whenever it changes (cheap: no row data in this blob).
  useEffect(() => {
    if (!hydrated.current || rows.length === 0) return;
    void saveProgress({ version: 1, mapping, decisions, currentIndex, savedAt: Date.now() });
  }, [mapping, decisions, currentIndex, rows.length]);

  const handleParsed = (parsed: ParsedCsv) => {
    const detected = autoDetectMapping(parsed.headers);
    setFileNames(parsed.fileNames);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(detected);
    setDecisions(new Array(parsed.rows.length).fill('pending'));
    setCurrentIndex(0);
    void saveData({ version: 1, fileNames: parsed.fileNames, headers: parsed.headers, rows: parsed.rows });
    setScreen('mapping');
  };

  const handleConfirmMapping = (confirmedMapping: ColumnMapping) => {
    setMapping(confirmedMapping);
    if (currentIndex >= rows.length) {
      setScreen('results');
    } else if (confirmedMapping.linkedin) {
      setScreen('enrich');
    } else {
      setScreen('review');
    }
  };

  const handleEnrichmentComplete = useCallback((result: EnrichmentMap) => {
    setEnrichment(result);
    void saveEnrichment(result);
    setScreen('review');
  }, []);

  const handleDecision = (direction: 'left' | 'right' | 'down') => {
    const decision = direction === 'right' ? 'approved' : direction === 'down' ? 'later' : 'rejected';
    setDecisions((prev) => {
      const next = [...prev];
      next[currentIndex] = decision;
      return next;
    });
    setCurrentIndex((i) => {
      const nextIndex = i + 1;
      if (nextIndex >= rows.length) setScreen('results');
      return nextIndex;
    });
  };


  const handleUndo = () => {
    setCurrentIndex((i) => {
      if (i === 0) return i;
      const prevIndex = i - 1;
      setDecisions((prevDecisions) => {
        const next = [...prevDecisions];
        next[prevIndex] = 'pending';
        return next;
      });
      setScreen('review');
      return prevIndex;
    });
  };

  const handleStartOver = () => {
    void clearSession();
    setFileNames([]);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setEnrichment({});
    setDecisions([]);
    setCurrentIndex(0);
    setScreen('upload');
  };

  if (screen === 'loading') {
    return <div className="flex flex-1 items-center justify-center text-[color:var(--color-text-faint)] text-sm">Laden…</div>;
  }

  if (screen === 'upload') {
    return <UploadScreen onParsed={handleParsed} />;
  }

  if (screen === 'mapping') {
    return (
      <ColumnMapper
        headers={headers}
        initialMapping={mapping}
        rowCount={rows.length}
        sampleRow={rows[0]}
        fileNames={fileNames}
        onConfirm={handleConfirmMapping}
        onCancel={handleStartOver}
      />
    );
  }

  if (screen === 'enrich') {
    return (
      <EnrichScreen
        rows={rows}
        mapping={mapping}
        existingEnrichment={enrichment}
        onComplete={handleEnrichmentComplete}
        onSkip={() => setScreen('review')}
      />
    );
  }

  if (screen === 'review') {
    return (
      <SwipeDeck
        rows={rows}
        headers={headers}
        mapping={mapping}
        enrichment={enrichment}
        decisions={decisions}
        currentIndex={currentIndex}
        onDecision={handleDecision}
        onUndo={handleUndo}
        onEditMapping={() => setScreen('mapping')}
      />
    );
  }

  return <ResultsScreen headers={headers} rows={rows} decisions={decisions} onStartOver={handleStartOver} onUndo={handleUndo} />;
}

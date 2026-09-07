import Papa from 'papaparse';
import type { CsvRow, Decision } from '../types';

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  fileNames: string[];
}

function parseSource(source: File | string): Promise<{ headers: string[]; rows: CsvRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(source as File, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter((h) => h && h.trim().length > 0);
        const rows = results.data.filter((row) =>
          Object.values(row).some((v) => (v ?? '').toString().trim().length > 0),
        );
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

function mergeParsed(results: { headers: string[]; rows: CsvRow[] }[], fileNames: string[]): ParsedCsv {
  const headerOrder: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    for (const h of r.headers) {
      if (!seen.has(h)) {
        seen.add(h);
        headerOrder.push(h);
      }
    }
  }

  const rows: CsvRow[] = [];
  for (const r of results) {
    for (const row of r.rows) {
      const normalized: CsvRow = {};
      for (const h of headerOrder) normalized[h] = row[h] ?? '';
      rows.push(normalized);
    }
  }

  return { headers: headerOrder, rows, fileNames };
}

export async function parseFiles(files: File[]): Promise<ParsedCsv> {
  const results = await Promise.all(files.map(parseSource));
  return mergeParsed(results, files.map((f) => f.name));
}

export async function parseCsvText(text: string, fileName: string): Promise<ParsedCsv> {
  const result = await parseSource(text);
  return mergeParsed([result], [fileName]);
}

export type ExportMode = 'approved' | 'rejected' | 'later' | 'all';

const STATUS_LABEL: Record<Decision, string> = {
  approved: 'goedgekeurd',
  rejected: 'afgekeurd',
  later: 'nog een keer bekijken',
  pending: 'niet beoordeeld',
};

const EXPORT_FILENAMES: Record<Exclude<ExportMode, 'all'>, string> = {
  approved: 'goedgekeurd.csv',
  rejected: 'afgekeurd.csv',
  later: 'opnieuw-bekijken.csv',
};

export function buildExportCsv(
  headers: string[],
  rows: CsvRow[],
  decisions: Decision[],
  mode: ExportMode,
): { csv: string; filename: string } {
  if (mode === 'all') {
    const outHeaders = [...headers, 'status'];
    const data = rows.map((row, i) => ({ ...row, status: STATUS_LABEL[decisions[i] ?? 'pending'] }));
    const csv = Papa.unparse({ fields: outHeaders, data });
    return { csv, filename: 'alle-resultaten.csv' };
  }

  const data = rows.filter((_, i) => decisions[i] === mode);
  const csv = Papa.unparse({ fields: headers, data });
  return { csv, filename: EXPORT_FILENAMES[mode] };
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import Papa from 'papaparse';
import type { CsvRow, Decision } from '../types';

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  fileNames: string[];
}

function parseSingleFile(file: File): Promise<{ headers: string[]; rows: CsvRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
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

export async function parseFiles(files: File[]): Promise<ParsedCsv> {
  const results = await Promise.all(files.map(parseSingleFile));

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

  return { headers: headerOrder, rows, fileNames: files.map((f) => f.name) };
}

export type ExportMode = 'approved' | 'rejected' | 'all';

const STATUS_LABEL: Record<Decision, string> = {
  approved: 'goedgekeurd',
  rejected: 'afgekeurd',
  pending: 'niet beoordeeld',
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

  const wanted: Decision = mode === 'approved' ? 'approved' : 'rejected';
  const data = rows.filter((_, i) => decisions[i] === wanted);
  const csv = Papa.unparse({ fields: headers, data });
  return { csv, filename: mode === 'approved' ? 'goedgekeurd.csv' : 'afgekeurd.csv' };
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

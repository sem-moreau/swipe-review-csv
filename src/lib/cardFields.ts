import type { ColumnMapping, CsvRow } from '../types';

export interface CardModel {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  industry?: string;
  companySize?: string;
  notes?: string;
  initials: string;
}

function clean(v: string | undefined): string | undefined {
  const t = v?.toString().trim();
  return t && t.length > 0 ? t : undefined;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function buildCardModel(row: CsvRow, mapping: ColumnMapping, headers: string[]): CardModel {
  let name = clean(mapping.name ? row[mapping.name] : undefined);

  if (!name) {
    const mappedValues = new Set(Object.values(mapping).filter(Boolean));
    const fallbackHeader = headers.find((h) => !mappedValues.has(h) && clean(row[h]));
    name = fallbackHeader ? clean(row[fallbackHeader]) : undefined;
  }
  name = name ?? 'Onbekend record';

  const linkedinRaw = clean(mapping.linkedin ? row[mapping.linkedin] : undefined);

  return {
    name,
    title: clean(mapping.title ? row[mapping.title] : undefined),
    company: clean(mapping.company ? row[mapping.company] : undefined),
    location: clean(mapping.location ? row[mapping.location] : undefined),
    linkedinUrl: linkedinRaw ? normalizeUrl(linkedinRaw) : undefined,
    industry: clean(mapping.industry ? row[mapping.industry] : undefined),
    companySize: clean(mapping.companySize ? row[mapping.companySize] : undefined),
    notes: clean(mapping.notes ? row[mapping.notes] : undefined),
    initials: initialsFrom(name),
  };
}

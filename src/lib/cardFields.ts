import type { BizdexTopic, ColumnMapping, CsvRow, EnrichmentRecord } from '../types';

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
  avatarUrl?: string;
  headline?: string;
  bio?: string;
  supply?: BizdexTopic[];
  demand?: BizdexTopic[];
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

function locationFromEnrichment(enrichment: EnrichmentRecord | undefined): string | undefined {
  const loc = enrichment?.person?.location;
  if (!loc) return undefined;
  return clean([loc.city, loc.country].filter(Boolean).join(', '));
}

function industryFromEnrichment(enrichment: EnrichmentRecord | undefined): string | undefined {
  const industries = enrichment?.person?.signals?.industries;
  if (!industries || industries.length === 0) return undefined;
  return industries.slice(0, 3).join(', ');
}

export function buildCardModel(
  row: CsvRow,
  mapping: ColumnMapping,
  headers: string[],
  enrichment?: EnrichmentRecord,
): CardModel {
  let name = clean(mapping.name ? row[mapping.name] : undefined);

  if (!name) {
    const mappedValues = new Set(Object.values(mapping).filter(Boolean));
    const fallbackHeader = headers.find((h) => !mappedValues.has(h) && clean(row[h]));
    name = fallbackHeader ? clean(row[fallbackHeader]) : undefined;
  }
  name = name ?? clean(enrichment?.person?.displayName) ?? 'Onbekend record';

  const linkedinRaw = clean(mapping.linkedin ? row[mapping.linkedin] : undefined);
  const title = clean(mapping.title ? row[mapping.title] : undefined);
  const company = clean(mapping.company ? row[mapping.company] : undefined);
  const person = enrichment?.status === 'completed' ? enrichment.person : undefined;

  return {
    name,
    title,
    company,
    location: clean(mapping.location ? row[mapping.location] : undefined) ?? locationFromEnrichment(enrichment),
    linkedinUrl: linkedinRaw ? normalizeUrl(linkedinRaw) : undefined,
    industry: clean(mapping.industry ? row[mapping.industry] : undefined) ?? industryFromEnrichment(enrichment),
    companySize: clean(mapping.companySize ? row[mapping.companySize] : undefined),
    notes: clean(mapping.notes ? row[mapping.notes] : undefined),
    initials: initialsFrom(name),
    avatarUrl: person?.avatarUrl,
    headline: clean(person?.headline),
    bio: clean(person?.bio),
    supply: enrichment?.supply,
    demand: enrichment?.demand,
  };
}

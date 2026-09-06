import type { ColumnMapping, FieldKey } from '../types';
import { FIELD_ORDER } from '../types';

function normalize(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SYNONYMS: Record<FieldKey, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'person', 'naam', 'volledige naam', 'first name'],
  title: ['title', 'job title', 'jobtitle', 'position', 'role', 'function', 'functie', 'functietitel'],
  company: ['company', 'company name', 'organization', 'organisation', 'employer', 'bedrijf', 'bedrijfsnaam', 'account name'],
  location: ['location', 'city', 'country', 'region', 'geo', 'locatie', 'land', 'plaats', 'city country'],
  linkedin: ['linkedin', 'linkedin url', 'linkedin profile', 'li url', 'profile url', 'person linkedin url', 'linkedin profile url'],
  industry: ['industry', 'sector', 'branche', 'company industry'],
  companySize: ['company size', 'employees', 'headcount', 'size', 'company size range', 'employee count', 'aantal medewerkers', '# employees'],
  notes: ['notes', 'note', 'opmerkingen', 'comment', 'comments', 'notities'],
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  // Pass 1: exact match against synonyms
  for (const field of FIELD_ORDER) {
    const synonymSet = new Set(SYNONYMS[field].map(normalize));
    const match = normalizedHeaders.find((h) => !used.has(h.raw) && synonymSet.has(h.norm));
    if (match) {
      mapping[field] = match.raw;
      used.add(match.raw);
    }
  }

  // Pass 2: substring match for anything still unmapped
  for (const field of FIELD_ORDER) {
    if (mapping[field]) continue;
    const synonyms = SYNONYMS[field];
    const match = normalizedHeaders.find(
      (h) => !used.has(h.raw) && synonyms.some((s) => h.norm.includes(s) || s.includes(h.norm)),
    );
    if (match) {
      mapping[field] = match.raw;
      used.add(match.raw);
    }
  }

  return mapping;
}

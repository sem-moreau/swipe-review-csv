import type { ColumnMapping, CsvRow, FieldKey } from '../types';
import { FIELD_ORDER } from '../types';

function normalize(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase: "defaultProfileUrl" -> "default Profile Url"
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// The camelCase split above also fires on brand names that aren't actually
// compound words, e.g. "LinkedIn" -> "linked in". Comparing with all spaces
// stripped catches those too, without weakening the exact/substring matches
// that already work (e.g. "defaultProfileUrl" -> "default profile url").
function compact(normalized: string): string {
  return normalized.replace(/\s+/g, '');
}

const SYNONYMS: Record<FieldKey, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'person', 'naam', 'volledige naam', 'first name'],
  title: ['title', 'job title', 'jobtitle', 'position', 'role', 'function', 'functie', 'functietitel'],
  company: ['company', 'company name', 'organization', 'organisation', 'employer', 'bedrijf', 'bedrijfsnaam', 'account name'],
  location: ['location', 'city', 'country', 'region', 'geo', 'locatie', 'land', 'plaats', 'city country'],
  linkedin: [
    'linkedin',
    'linkedin url',
    'linkedin profile',
    'li url',
    'profile url',
    'person linkedin url',
    'linkedin profile url',
    'default profile url',
  ],
  photo: ['photo', 'photo url', 'picture', 'picture url', 'avatar', 'avatar url', 'profile image', 'profile image url', 'profileimageurl', 'foto'],
  industry: ['industry', 'sector', 'branche', 'company industry'],
  companySize: ['company size', 'employees', 'headcount', 'size', 'company size range', 'employee count', 'aantal medewerkers', '# employees'],
  notes: ['notes', 'note', 'opmerkingen', 'comment', 'comments', 'notities'],
};

// A real LinkedIn vanity slug is lowercase letters/digits/hyphens only (LinkedIn
// enforces this). Sales Navigator / scraper exports often also carry an
// internal member id (e.g. "ACwAAAADgAcB8sddRR6Qz0rLwoCloLL2vPHzjOk") in a
// column that also looks like a "linkedin url" field by name — those ids are
// mixed-case and unusable for lookups, so this check (case-sensitive on the
// slug) is what tells the two apart.
const CLEAN_LINKEDIN_SLUG = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9-]{2,100}\/?(\?.*)?$/;

function cleanLinkedinScore(headerRaw: string, rows: CsvRow[]): number {
  let score = 0;
  let checked = 0;
  for (const row of rows) {
    const value = row[headerRaw]?.trim();
    if (!value) continue;
    checked += 1;
    if (CLEAN_LINKEDIN_SLUG.test(value)) score += 1;
    if (checked >= 10) break;
  }
  return score;
}

function detectLinkedinColumn(headers: string[], rows: CsvRow[]): string | undefined {
  const synonymSet = new Set(SYNONYMS.linkedin.map(normalize));
  const compactSynonymSet = new Set(SYNONYMS.linkedin.map((s) => compact(normalize(s))));
  const candidates = headers.filter((h) => {
    const norm = normalize(h);
    return (
      synonymSet.has(norm) ||
      compactSynonymSet.has(compact(norm)) ||
      SYNONYMS.linkedin.some((s) => norm.includes(s) || s.includes(norm))
    );
  });
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  // Multiple linkedin-ish columns (common in Sales Navigator exports): pick
  // whichever actually holds clean, lookup-able profile URLs.
  const scored = candidates.map((h) => ({ h, score: cleanLinkedinScore(h, rows) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].h : candidates[0];
}

export function autoDetectMapping(headers: string[], rows: CsvRow[] = []): ColumnMapping {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  const linkedinColumn = detectLinkedinColumn(headers, rows);
  if (linkedinColumn) {
    mapping.linkedin = linkedinColumn;
    used.add(linkedinColumn);
  }

  const remainingFields = FIELD_ORDER.filter((f) => f !== 'linkedin');

  // Pass 1: exact match against synonyms
  for (const field of remainingFields) {
    const synonymSet = new Set(SYNONYMS[field].map(normalize));
    const compactSynonymSet = new Set(SYNONYMS[field].map((s) => compact(normalize(s))));
    const match = normalizedHeaders.find(
      (h) => !used.has(h.raw) && (synonymSet.has(h.norm) || compactSynonymSet.has(compact(h.norm))),
    );
    if (match) {
      mapping[field] = match.raw;
      used.add(match.raw);
    }
  }

  // Pass 2: substring match for anything still unmapped
  for (const field of remainingFields) {
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

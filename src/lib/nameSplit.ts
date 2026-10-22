import type { CsvRow } from '../types';

const FIRST_NAME_SYNONYMS = ['firstname', 'first name', 'voornaam'];
const LAST_NAME_SYNONYMS = ['lastname', 'last name', 'achternaam', 'surname', 'family name'];

function normalize(header: string): string {
  return header.toLowerCase().trim();
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  return headers.find((h) => candidates.includes(normalize(h)));
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Adds "Voornaam"/"Achternaam" columns derived from `nameColumn`, placed right after it.
 * No-ops if the data already has dedicated first/last name columns (e.g. Sales Navigator
 * exports), or if there's no name column to split.
 */
export function addNameColumns(headers: string[], rows: CsvRow[], nameColumn?: string): { headers: string[]; rows: CsvRow[] } {
  if (findHeader(headers, FIRST_NAME_SYNONYMS) && findHeader(headers, LAST_NAME_SYNONYMS)) {
    return { headers, rows };
  }
  if (!nameColumn || !headers.includes(nameColumn)) return { headers, rows };

  const firstNameHeader = 'Voornaam';
  const lastNameHeader = 'Achternaam';
  if (headers.includes(firstNameHeader) || headers.includes(lastNameHeader)) return { headers, rows };

  const sourceIdx = headers.indexOf(nameColumn);
  const newHeaders = [...headers];
  newHeaders.splice(sourceIdx + 1, 0, firstNameHeader, lastNameHeader);

  const newRows = rows.map((row) => {
    const { firstName, lastName } = splitFullName((row[nameColumn] ?? '').toString());
    return { ...row, [firstNameHeader]: firstName, [lastNameHeader]: lastName };
  });

  return { headers: newHeaders, rows: newRows };
}

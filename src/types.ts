export type CsvRow = Record<string, string>;

export type FieldKey =
  | 'name'
  | 'title'
  | 'company'
  | 'location'
  | 'linkedin'
  | 'industry'
  | 'companySize'
  | 'notes';

export type ColumnMapping = Partial<Record<FieldKey, string>>;

export type Decision = 'pending' | 'approved' | 'rejected';

export interface SwipeData {
  version: 1;
  fileNames: string[];
  headers: string[];
  rows: CsvRow[];
}

export interface SwipeProgress {
  version: 1;
  mapping: ColumnMapping;
  decisions: Decision[];
  currentIndex: number;
  savedAt: number;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Naam',
  title: 'Functietitel',
  company: 'Bedrijf',
  location: 'Locatie',
  linkedin: 'LinkedIn URL',
  industry: 'Branche',
  companySize: 'Bedrijfsgrootte',
  notes: 'Notities',
};

export const FIELD_ORDER: FieldKey[] = [
  'name',
  'title',
  'company',
  'location',
  'linkedin',
  'industry',
  'companySize',
  'notes',
];

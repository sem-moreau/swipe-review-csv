export type CsvRow = Record<string, string>;

export type FieldKey =
  | 'name'
  | 'title'
  | 'company'
  | 'location'
  | 'linkedin'
  | 'photo'
  | 'industry'
  | 'companySize'
  | 'notes';

export type ColumnMapping = Partial<Record<FieldKey, string>>;

export type Decision = 'pending' | 'approved' | 'rejected' | 'later';

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

export interface BizdexTopic {
  title: string;
  description?: string;
  tags?: string[];
}

export interface BizdexPerson {
  displayName?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: { city?: string; country?: string; countryCode?: string };
  signals?: { industries?: string[]; careerStage?: string; languages?: string[] };
}

export interface EnrichmentRecord {
  status: string;
  person?: BizdexPerson;
  supply?: BizdexTopic[];
  demand?: BizdexTopic[];
}

export type EnrichmentMap = Record<string, EnrichmentRecord>;

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Naam',
  title: 'Functietitel',
  company: 'Bedrijf',
  location: 'Locatie',
  linkedin: 'LinkedIn URL',
  photo: 'Profielfoto URL',
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
  'photo',
  'industry',
  'companySize',
  'notes',
];

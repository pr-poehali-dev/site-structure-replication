import func2url from '../../backend/func2url.json';

export const ELECTRONIC_RESULTS_URL = func2url['electronic-results'];

export type NominationKind = 'best_mate' | 'beautiful_mate' | 'best_woman';

export const NOMINATIONS: { kind: NominationKind; label: string; places: number }[] = [
  { kind: 'best_mate', label: 'Самый быстрый мат 1го тура', places: 1 },
  { kind: 'beautiful_mate', label: 'Самый красивый мат', places: 3 },
  { kind: 'best_woman', label: 'Лучшая шахматистка', places: 3 },
];

export interface AgeGroup { name: string; min: number; max: number }

export interface ResultRow {
  rank: number | null;
  username: string;
  user_id: number | null;
  fio: string;
  age: number | null;
  gender: string | null;
  points: number;
  tieBreak?: number | null;
  rating?: number | null;
  performance?: number | null;
  group?: string | null;
  place?: number;
}

export interface NominationEntry {
  place: number;
  username: string;
  fio?: string;
  game_url: string | null;
  group_name?: string;
  kind?: NominationKind;
}

export interface GroupSnapshot {
  name: string;
  min: number;
  max: number;
  table: ResultRow[];
  nominations: Record<NominationKind, NominationEntry[]>;
}

export interface ResultsSnapshot {
  tournament: { id: number; title: string; date: string | null; has_hall?: boolean; protocol_url?: string | null };
  overall: ResultRow[];
  groups: GroupSnapshot[];
}

export interface ResultFile {
  username: string;
  kind: string;
  file_url: string;
  file_name: string | null;
}
import func2url from '../../backend/func2url.json';

export const PUZZLES_URL = func2url['puzzles'];

export interface Puzzle {
  id: number;
  title: string;
  fen: string;
  difficulty: number;
  theme: string | null;
  has_hint: boolean;
  turn: 'w' | 'b';
  moves_count: number;
  solved: boolean;
}

export interface AdminPuzzle {
  id: number;
  title: string;
  fen: string;
  solution: string;
  difficulty: number;
  theme: string | null;
  hint: string | null;
  is_active: boolean;
  solves: number;
}

export interface Leader {
  user_id: number;
  fio: string;
  avatar_url: string | null;
  solved: number;
}

export const FILES = 'abcdefgh';

export function parseFen(fen: string): (string | null)[][] {
  return fen.split(' ')[0].split('/').map(row => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null);
      else cells.push(ch);
    }
    return cells;
  });
}

export function applyUci(fen: string, uci: string): string {
  const parts = fen.split(' ');
  const board = parseFen(fen);
  const fF = FILES.indexOf(uci[0]), fR = 8 - parseInt(uci[1], 10);
  const tF = FILES.indexOf(uci[2]), tR = 8 - parseInt(uci[3], 10);
  let piece = board[fR][fF];
  if (!piece) return fen;
  const movedPiece = piece;
  const white = piece === piece.toUpperCase();
  if (piece.toUpperCase() === 'P' && fF !== tF && !board[tR][tF]) board[fR][tF] = null;
  if (piece.toUpperCase() === 'K' && Math.abs(tF - fF) === 2) {
    if (tF > fF) { board[fR][5] = board[fR][7]; board[fR][7] = null; }
    else { board[fR][3] = board[fR][0]; board[fR][0] = null; }
  }
  board[fR][fF] = null;
  if (uci[4]) piece = white ? uci[4].toUpperCase() : uci[4].toLowerCase();
  board[tR][tF] = piece;
  parts[0] = board.map(row => {
    let s = ''; let empty = 0;
    for (const c of row) {
      if (c === null) empty++;
      else { if (empty) { s += empty; empty = 0; } s += c; }
    }
    return s + (empty || '');
  }).join('/');
  let castling = (parts[2] || '-').replace('-', '');
  const drop = (chars: string) => { castling = castling.split('').filter(c => !chars.includes(c)).join(''); };
  if (movedPiece === 'K') drop('KQ');
  if (movedPiece === 'k') drop('kq');
  for (const s of [uci.slice(0, 2), uci.slice(2, 4)]) {
    if (s === 'a1') drop('Q');
    if (s === 'h1') drop('K');
    if (s === 'a8') drop('q');
    if (s === 'h8') drop('k');
  }
  parts[2] = castling || '-';
  parts[3] = movedPiece.toUpperCase() === 'P' && Math.abs(tR - fR) === 2 ? FILES[fF] + String((8 - fR + 8 - tR) / 2) : '-';
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}

export const DIFFICULTY_LABELS = ['', 'Очень лёгкая', 'Лёгкая', 'Средняя', 'Сложная', 'Очень сложная'];

export function isValidFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2 || !['w', 'b'].includes(parts[1])) return false;
  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;
  let kings = 0;
  for (const row of rows) {
    let n = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) n += parseInt(ch, 10);
      else if (/[pnbrqkPNBRQK]/.test(ch)) { n += 1; if (ch === 'k' || ch === 'K') kings++; }
      else return false;
    }
    if (n !== 8) return false;
  }
  return kings === 2;
}

export function replaySolution(fen: string, solution: string[]): string {
  let cur = fen;
  for (const m of solution) cur = applyUci(cur, m);
  return cur;
}

const FILES = 'abcdefgh';

type Board = (string | null)[][]; // board[rank][file], rank 0 = "1", rank 7 = "8"

interface ParsedFen {
  board: Board;
  turn: 'w' | 'b';
  castling: string;
  ep: string | null;
}

function sq(file: number, rank: number): string {
  return FILES[file] + String(rank + 1);
}

function parseSq(s: string): [number, number] {
  return [FILES.indexOf(s[0]), parseInt(s[1], 10) - 1];
}

function parseFenFull(fen: string): ParsedFen {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  rows.forEach((row, r) => {
    const rank = 7 - r;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += parseInt(ch, 10);
      } else {
        board[rank][f] = ch;
        f += 1;
      }
    }
  });
  return {
    board,
    turn: parts[1] === 'w' ? 'w' : 'b',
    castling: parts[2] || '-',
    ep: parts[3] && parts[3] !== '-' ? parts[3] : null,
  };
}

function isWhitePiece(p: string | null): boolean {
  return p !== null && p === p.toUpperCase();
}
function isBlackPiece(p: string | null): boolean {
  return p !== null && p === p.toLowerCase() && p !== p.toUpperCase();
}
function ownPiece(p: string | null, color: 'w' | 'b'): boolean {
  if (p === null) return false;
  return color === 'w' ? isWhitePiece(p) : isBlackPiece(p);
}
function enemyPiece(p: string | null, color: 'w' | 'b'): boolean {
  if (p === null) return false;
  return color === 'w' ? isBlackPiece(p) : isWhitePiece(p);
}

function findKing(board: Board, color: 'w' | 'b'): [number, number] | null {
  const target = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (board[r][f] === target) return [f, r];
    }
  }
  return null;
}

function squareAttacked(board: Board, fileIdx: number, rankIdx: number, byColor: 'w' | 'b'): boolean {
  const direction = byColor === 'w' ? 1 : -1;
  const pawn = byColor === 'w' ? 'P' : 'p';
  for (const df of [-1, 1]) {
    const pf = fileIdx + df, pr = rankIdx - direction;
    if (pf >= 0 && pf < 8 && pr >= 0 && pr < 8 && board[pr][pf] === pawn) return true;
  }
  const knight = byColor === 'w' ? 'N' : 'n';
  for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    const nf = fileIdx + df, nr = rankIdx + dr;
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && board[nr][nf] === knight) return true;
  }
  const king = byColor === 'w' ? 'K' : 'k';
  for (const df of [-1, 0, 1]) {
    for (const dr of [-1, 0, 1]) {
      if (df === 0 && dr === 0) continue;
      const nf = fileIdx + df, nr = rankIdx + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && board[nr][nf] === king) return true;
    }
  }
  const bishop = byColor === 'w' ? 'B' : 'b';
  const queen = byColor === 'w' ? 'Q' : 'q';
  const rook = byColor === 'w' ? 'R' : 'r';
  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let nf = fileIdx + df, nr = rankIdx + dr;
    while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
      const p = board[nr][nf];
      if (p !== null) {
        if (p === bishop || p === queen) return true;
        break;
      }
      nf += df; nr += dr;
    }
  }
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let nf = fileIdx + df, nr = rankIdx + dr;
    while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
      const p = board[nr][nf];
      if (p !== null) {
        if (p === rook || p === queen) return true;
        break;
      }
      nf += df; nr += dr;
    }
  }
  return false;
}

function inCheck(board: Board, color: 'w' | 'b'): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return squareAttacked(board, kingPos[0], kingPos[1], color === 'w' ? 'b' : 'w');
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.slice());
}

interface Move { f1: number; r1: number; f2: number; r2: number; extra: string | null; }

function pseudoMovesForPiece(state: ParsedFen, f: number, r: number): Move[] {
  const { board, castling, ep } = state;
  const p = board[r][f];
  if (!p) return [];
  const color: 'w' | 'b' = p === p.toUpperCase() ? 'w' : 'b';
  const kind = p.toUpperCase();
  const moves: Move[] = [];

  if (kind === 'P') {
    const direction = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 1 : 6;
    const promoRank = color === 'w' ? 7 : 0;
    const nr = r + direction;
    if (nr >= 0 && nr < 8 && board[nr][f] === null) {
      if (nr === promoRank) {
        for (const promo of ['Q', 'R', 'B', 'N']) moves.push({ f1: f, r1: r, f2: f, r2: nr, extra: promo });
      } else {
        moves.push({ f1: f, r1: r, f2: f, r2: nr, extra: null });
      }
      const nr2 = r + 2 * direction;
      if (r === startRank && nr2 >= 0 && nr2 < 8 && board[nr2][f] === null) {
        moves.push({ f1: f, r1: r, f2: f, r2: nr2, extra: null });
      }
    }
    for (const df of [-1, 1]) {
      const nf = f + df;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const target = board[nr][nf];
        if (enemyPiece(target, color)) {
          if (nr === promoRank) {
            for (const promo of ['Q', 'R', 'B', 'N']) moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: promo });
          } else {
            moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: null });
          }
        } else if (ep && nf === parseSq(ep)[0] && nr === parseSq(ep)[1]) {
          moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: 'ep' });
        }
      }
    }
  } else if (kind === 'N') {
    for (const [df, dr] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && !ownPiece(board[nr][nf], color)) {
        moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: null });
      }
    }
  } else if (kind === 'K') {
    for (const df of [-1, 0, 1]) {
      for (const dr of [-1, 0, 1]) {
        if (df === 0 && dr === 0) continue;
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && !ownPiece(board[nr][nf], color)) {
          moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: null });
        }
      }
    }
    const enemyColor: 'w' | 'b' = color === 'w' ? 'b' : 'w';
    const rank0 = color === 'w' ? 0 : 7;
    if (r === rank0 && f === 4 && !inCheck(board, color)) {
      const kFlag = color === 'w' ? 'K' : 'k';
      const qFlag = color === 'w' ? 'Q' : 'q';
      if (castling.includes(kFlag) && board[rank0][5] === null && board[rank0][6] === null) {
        if (!squareAttacked(board, 5, rank0, enemyColor) && !squareAttacked(board, 6, rank0, enemyColor)) {
          moves.push({ f1: f, r1: r, f2: 6, r2: rank0, extra: 'O-O' });
        }
      }
      if (castling.includes(qFlag) && board[rank0][1] === null && board[rank0][2] === null && board[rank0][3] === null) {
        if (!squareAttacked(board, 3, rank0, enemyColor) && !squareAttacked(board, 2, rank0, enemyColor)) {
          moves.push({ f1: f, r1: r, f2: 2, r2: rank0, extra: 'O-O-O' });
        }
      }
    }
  } else if (kind === 'B' || kind === 'R' || kind === 'Q') {
    const dirs: [number, number][] = [];
    if (kind === 'B' || kind === 'Q') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (kind === 'R' || kind === 'Q') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    for (const [df, dr] of dirs) {
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const target = board[nr][nf];
        if (target === null) {
          moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: null });
        } else {
          if (enemyPiece(target, color)) moves.push({ f1: f, r1: r, f2: nf, r2: nr, extra: null });
          break;
        }
        nf += df; nr += dr;
      }
    }
  }

  return moves;
}

function applyMove(state: ParsedFen, mv: Move): Board {
  const board = cloneBoard(state.board);
  const p = board[mv.r1][mv.f1];
  if (!p) return board;
  const color: 'w' | 'b' = p === p.toUpperCase() ? 'w' : 'b';

  if (mv.extra === 'ep') {
    board[mv.r2][mv.f2] = p;
    board[mv.r1][mv.f1] = null;
    board[mv.r1][mv.f2] = null;
  } else if (mv.extra === 'O-O' || mv.extra === 'O-O-O') {
    board[mv.r2][mv.f2] = p;
    board[mv.r1][mv.f1] = null;
    const rank0 = mv.r1;
    if (mv.extra === 'O-O') {
      const rook = board[rank0][7];
      board[rank0][7] = null;
      board[rank0][5] = rook;
    } else {
      const rook = board[rank0][0];
      board[rank0][0] = null;
      board[rank0][3] = rook;
    }
  } else if (mv.extra && ['Q', 'R', 'B', 'N'].includes(mv.extra)) {
    const promo = color === 'w' ? mv.extra : mv.extra.toLowerCase();
    board[mv.r2][mv.f2] = promo;
    board[mv.r1][mv.f1] = null;
  } else {
    board[mv.r2][mv.f2] = p;
    board[mv.r1][mv.f1] = null;
  }
  return board;
}

/**
 * Возвращает клетку короля стороны, чей сейчас ход, если этот король под шахом
 * в переданной позиции (например 'e1'), иначе null. Используется для подсветки
 * шаха на доске.
 */
export function getCheckedKingSquare(fen: string): string | null {
  const state = parseFenFull(fen);
  if (!inCheck(state.board, state.turn)) return null;
  const kingPos = findKing(state.board, state.turn);
  return kingPos ? sq(kingPos[0], kingPos[1]) : null;
}

/**
 * Возвращает список клеток (например ['e4', 'e5']), на которые фигура на sqName
 * может сходить по правилам шахмат (легальные ходы, с учётом шаха своему королю).
 * Используется только для подсказки на клиенте — окончательную валидацию делает бэкенд.
 */
export function getLegalTargets(fen: string, sqName: string): string[] {
  const state = parseFenFull(fen);
  const [f, r] = parseSq(sqName);
  const p = state.board[r][f];
  if (!p) return [];
  const color: 'w' | 'b' = p === p.toUpperCase() ? 'w' : 'b';
  const pseudo = pseudoMovesForPiece(state, f, r);
  const result: string[] = [];
  for (const mv of pseudo) {
    const newBoard = applyMove(state, mv);
    if (!inCheck(newBoard, color)) {
      result.push(sq(mv.f2, mv.r2));
    }
  }
  return result;
}
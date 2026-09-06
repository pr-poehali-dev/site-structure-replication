"""Минимальный движок шахматных правил на чистом Python, без внешних зависимостей.

Поддерживает: генерацию легальных ходов, рокировку, взятие на проходе,
превращение пешки, шах/мат/пат, повторение позиции и правило 50 ходов
не реализованы полно, но не требуются для базового зала.
"""

FILES = 'abcdefgh'


def sq(file_idx, rank_idx):
    return FILES[file_idx] + str(rank_idx + 1)


def parse_sq(s):
    return FILES.index(s[0]), int(s[1]) - 1


START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'


class Board:
    def __init__(self, fen=START_FEN):
        self.load_fen(fen)

    def load_fen(self, fen):
        parts = fen.split()
        rows = parts[0].split('/')
        self.board = [[None] * 8 for _ in range(8)]
        for r, row in enumerate(rows):
            rank = 7 - r
            f = 0
            for ch in row:
                if ch.isdigit():
                    f += int(ch)
                else:
                    self.board[rank][f] = ch
                    f += 1
        self.turn = 'w' if parts[1] == 'w' else 'b'
        self.castling = parts[2] if len(parts) > 2 else '-'
        self.ep = parts[3] if len(parts) > 3 and parts[3] != '-' else None
        self.halfmove = int(parts[4]) if len(parts) > 4 else 0
        self.fullmove = int(parts[5]) if len(parts) > 5 else 1

    def to_fen(self):
        rows = []
        for rank in range(7, -1, -1):
            row = ''
            empty = 0
            for f in range(8):
                p = self.board[rank][f]
                if p is None:
                    empty += 1
                else:
                    if empty:
                        row += str(empty)
                        empty = 0
                    row += p
            if empty:
                row += str(empty)
            rows.append(row)
        board_part = '/'.join(rows)
        ep = self.ep if self.ep else '-'
        castling = self.castling if self.castling else '-'
        return f"{board_part} {self.turn} {castling} {ep} {self.halfmove} {self.fullmove}"

    def piece_at(self, file_idx, rank_idx):
        return self.board[rank_idx][file_idx]

    def is_white(self, p):
        return p is not None and p.isupper()

    def is_black(self, p):
        return p is not None and p.islower()

    def own(self, p, color):
        if p is None:
            return False
        return p.isupper() if color == 'w' else p.islower()

    def enemy(self, p, color):
        if p is None:
            return False
        return p.islower() if color == 'w' else p.isupper()

    def find_king(self, color):
        target = 'K' if color == 'w' else 'k'
        for r in range(8):
            for f in range(8):
                if self.board[r][f] == target:
                    return f, r
        return None

    def square_attacked(self, file_idx, rank_idx, by_color):
        # Пешки
        direction = 1 if by_color == 'w' else -1
        pawn = 'P' if by_color == 'w' else 'p'
        for df in (-1, 1):
            pf, pr = file_idx + df, rank_idx - direction
            if 0 <= pf < 8 and 0 <= pr < 8 and self.board[pr][pf] == pawn:
                return True
        # Конь
        knight = 'N' if by_color == 'w' else 'n'
        for df, dr in [(1, 2), (2, 1), (-1, 2), (-2, 1), (1, -2), (2, -1), (-1, -2), (-2, -1)]:
            nf, nr = file_idx + df, rank_idx + dr
            if 0 <= nf < 8 and 0 <= nr < 8 and self.board[nr][nf] == knight:
                return True
        # Король
        king = 'K' if by_color == 'w' else 'k'
        for df in (-1, 0, 1):
            for dr in (-1, 0, 1):
                if df == 0 and dr == 0:
                    continue
                nf, nr = file_idx + df, rank_idx + dr
                if 0 <= nf < 8 and 0 <= nr < 8 and self.board[nr][nf] == king:
                    return True
        # Слон/ферзь по диагоналям
        bishop = 'B' if by_color == 'w' else 'b'
        queen = 'Q' if by_color == 'w' else 'q'
        rook = 'R' if by_color == 'w' else 'r'
        for df, dr in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
            nf, nr = file_idx + df, rank_idx + dr
            while 0 <= nf < 8 and 0 <= nr < 8:
                p = self.board[nr][nf]
                if p is not None:
                    if p == bishop or p == queen:
                        return True
                    break
                nf += df
                nr += dr
        # Ладья/ферзь по горизонталям/вертикалям
        for df, dr in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nf, nr = file_idx + df, rank_idx + dr
            while 0 <= nf < 8 and 0 <= nr < 8:
                p = self.board[nr][nf]
                if p is not None:
                    if p == rook or p == queen:
                        return True
                    break
                nf += df
                nr += dr
        return False

    def in_check(self, color):
        king_pos = self.find_king(color)
        if not king_pos:
            return False
        enemy_color = 'b' if color == 'w' else 'w'
        return self.square_attacked(king_pos[0], king_pos[1], enemy_color)

    def clone(self):
        b = Board.__new__(Board)
        b.board = [row[:] for row in self.board]
        b.turn = self.turn
        b.castling = self.castling
        b.ep = self.ep
        b.halfmove = self.halfmove
        b.fullmove = self.fullmove
        return b

    def pseudo_moves_for_piece(self, f, r):
        p = self.board[r][f]
        if p is None:
            return []
        color = 'w' if p.isupper() else 'b'
        kind = p.upper()
        moves = []

        if kind == 'P':
            direction = 1 if color == 'w' else -1
            start_rank = 1 if color == 'w' else 6
            promo_rank = 7 if color == 'w' else 0
            nr = r + direction
            if 0 <= nr < 8 and self.board[nr][f] is None:
                if nr == promo_rank:
                    for promo in 'QRBN':
                        moves.append((f, r, f, nr, promo))
                else:
                    moves.append((f, r, f, nr, None))
                nr2 = r + 2 * direction
                if r == start_rank and 0 <= nr2 < 8 and self.board[nr2][f] is None:
                    moves.append((f, r, f, nr2, None))
            for df in (-1, 1):
                nf = f + df
                if 0 <= nf < 8 and 0 <= nr < 8:
                    target = self.board[nr][nf]
                    if self.enemy(target, color):
                        if nr == promo_rank:
                            for promo in 'QRBN':
                                moves.append((f, r, nf, nr, promo))
                        else:
                            moves.append((f, r, nf, nr, None))
                    elif self.ep and (nf, nr) == parse_sq(self.ep):
                        moves.append((f, r, nf, nr, 'ep'))

        elif kind == 'N':
            for df, dr in [(1, 2), (2, 1), (-1, 2), (-2, 1), (1, -2), (2, -1), (-1, -2), (-2, -1)]:
                nf, nr = f + df, r + dr
                if 0 <= nf < 8 and 0 <= nr < 8 and not self.own(self.board[nr][nf], color):
                    moves.append((f, r, nf, nr, None))

        elif kind == 'K':
            for df in (-1, 0, 1):
                for dr in (-1, 0, 1):
                    if df == 0 and dr == 0:
                        continue
                    nf, nr = f + df, r + dr
                    if 0 <= nf < 8 and 0 <= nr < 8 and not self.own(self.board[nr][nf], color):
                        moves.append((f, r, nf, nr, None))
            # Рокировка
            enemy_color = 'b' if color == 'w' else 'w'
            rank0 = 0 if color == 'w' else 7
            if r == rank0 and f == 4 and not self.in_check(color):
                k_flag = 'K' if color == 'w' else 'k'
                q_flag = 'Q' if color == 'w' else 'q'
                if k_flag in self.castling and self.board[rank0][5] is None and self.board[rank0][6] is None:
                    if not self.square_attacked(5, rank0, enemy_color) and not self.square_attacked(6, rank0, enemy_color):
                        moves.append((f, r, 6, rank0, 'O-O'))
                if q_flag in self.castling and self.board[rank0][1] is None and self.board[rank0][2] is None and self.board[rank0][3] is None:
                    if not self.square_attacked(3, rank0, enemy_color) and not self.square_attacked(2, rank0, enemy_color):
                        moves.append((f, r, 2, rank0, 'O-O-O'))

        elif kind in ('B', 'R', 'Q'):
            dirs = []
            if kind in ('B', 'Q'):
                dirs += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
            if kind in ('R', 'Q'):
                dirs += [(1, 0), (-1, 0), (0, 1), (0, -1)]
            for df, dr in dirs:
                nf, nr = f + df, r + dr
                while 0 <= nf < 8 and 0 <= nr < 8:
                    target = self.board[nr][nf]
                    if target is None:
                        moves.append((f, r, nf, nr, None))
                    else:
                        if self.enemy(target, color):
                            moves.append((f, r, nf, nr, None))
                        break
                    nf += df
                    nr += dr

        return moves

    def apply_move(self, mv):
        f1, r1, f2, r2, extra = mv
        p = self.board[r1][f1]
        color = 'w' if p.isupper() else 'b'
        captured = self.board[r2][f2]

        self.ep = None

        if extra == 'ep':
            self.board[r2][f2] = p
            self.board[r1][f1] = None
            cap_rank = r1
            self.board[cap_rank][f2] = None
        elif extra in ('O-O', 'O-O-O'):
            self.board[r2][f2] = p
            self.board[r1][f1] = None
            rank0 = r1
            if extra == 'O-O':
                rook = self.board[rank0][7]
                self.board[rank0][7] = None
                self.board[rank0][5] = rook
            else:
                rook = self.board[rank0][0]
                self.board[rank0][0] = None
                self.board[rank0][3] = rook
        elif extra in ('Q', 'R', 'B', 'N'):
            promo = extra if color == 'w' else extra.lower()
            self.board[r2][f2] = promo
            self.board[r1][f1] = None
        else:
            self.board[r2][f2] = p
            self.board[r1][f1] = None
            if p.upper() == 'P' and abs(r2 - r1) == 2:
                self.ep = sq(f2, (r1 + r2) // 2)

        # Обновление прав рокировки
        def strip_castling(rank, file, flag_pair):
            if rank == (0 if flag_pair == 'w' else 7):
                pass

        if p.upper() == 'K':
            if color == 'w':
                self.castling = self.castling.replace('K', '').replace('Q', '')
            else:
                self.castling = self.castling.replace('k', '').replace('q', '')
        if p.upper() == 'R':
            if (f1, r1) == (0, 0):
                self.castling = self.castling.replace('Q', '')
            elif (f1, r1) == (7, 0):
                self.castling = self.castling.replace('K', '')
            elif (f1, r1) == (0, 7):
                self.castling = self.castling.replace('q', '')
            elif (f1, r1) == (7, 7):
                self.castling = self.castling.replace('k', '')
        if captured and captured.upper() == 'R':
            if (f2, r2) == (0, 0):
                self.castling = self.castling.replace('Q', '')
            elif (f2, r2) == (7, 0):
                self.castling = self.castling.replace('K', '')
            elif (f2, r2) == (0, 7):
                self.castling = self.castling.replace('q', '')
            elif (f2, r2) == (7, 7):
                self.castling = self.castling.replace('k', '')
        if not self.castling:
            self.castling = '-'

        if p.upper() == 'P' or captured is not None:
            self.halfmove = 0
        else:
            self.halfmove += 1

        if color == 'b':
            self.fullmove += 1
        self.turn = 'b' if color == 'w' else 'w'

    def legal_moves(self, color=None):
        color = color or self.turn
        result = []
        for r in range(8):
            for f in range(8):
                p = self.board[r][f]
                if p is None or not self.own(p, color):
                    continue
                for mv in self.pseudo_moves_for_piece(f, r):
                    test = self.clone()
                    test.apply_move(mv)
                    if not test.in_check(color):
                        result.append(mv)
        return result

    def find_move(self, from_sq, to_sq, promotion=None):
        f1, r1 = parse_sq(from_sq)
        f2, r2 = parse_sq(to_sq)
        promo = promotion.upper() if promotion else None
        for mv in self.legal_moves():
            if mv[0] == f1 and mv[1] == r1 and mv[2] == f2 and mv[3] == r2:
                if mv[4] in ('Q', 'R', 'B', 'N'):
                    if mv[4] == promo:
                        return mv
                else:
                    return mv
        return None

    def is_checkmate(self):
        return self.in_check(self.turn) and len(self.legal_moves()) == 0

    def is_stalemate(self):
        return not self.in_check(self.turn) and len(self.legal_moves()) == 0

    def is_insufficient_material(self):
        pieces = [p for row in self.board for p in row if p is not None]
        significant = [p for p in pieces if p.upper() not in ('K',)]
        if not significant:
            return True
        if len(significant) == 1 and significant[0].upper() in ('N', 'B'):
            return True
        return False

    def move_to_san(self, mv):
        f1, r1, f2, r2, extra = mv
        if extra == 'O-O':
            return 'O-O'
        if extra == 'O-O-O':
            return 'O-O-O'
        p = self.board[r1][f1]
        kind = p.upper()
        capture = self.board[r2][f2] is not None or extra == 'ep'
        dest = sq(f2, r2)
        if kind == 'P':
            san = (FILES[f1] + 'x' if capture else '') + dest
            if extra in ('Q', 'R', 'B', 'N'):
                san += '=' + extra
        else:
            san = kind + ('x' if capture else '') + dest
        return san

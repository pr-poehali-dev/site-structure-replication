function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function pieceIcon(piece: string): string {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  return `/chess-pieces/${color}${piece.toUpperCase()}.svg`;
}

interface MiniChessBoardProps {
  fen: string;
  size?: number;
}

export default function MiniChessBoard({ fen, size = 160 }: MiniChessBoardProps) {
  const board = parseFen(fen);
  return (
    <div
      className="grid grid-cols-8 grid-rows-8 rounded-md overflow-hidden shadow-md shrink-0"
      style={{ width: size, height: size }}
    >
      {board.map((row, rIdx) =>
        row.map((piece, fIdx) => {
          const isLight = (fIdx + rIdx) % 2 === 0;
          return (
            <div
              key={`${rIdx}-${fIdx}`}
              className={`relative flex items-center justify-center ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}`}
            >
              {piece && (
                <img src={pieceIcon(piece)} alt={piece} className="w-[85%] h-[85%] pointer-events-none select-none" draggable={false} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
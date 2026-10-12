import { useEffect, useState } from 'react';
import { getLegalTargets, getCheckedKingSquare } from '@/lib/chessMoves';
import { parseFen, FILES } from '@/lib/puzzles';

interface Props {
  fen: string;
  flipped?: boolean;
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
  hintSquare?: string | null;
  onMove: (from: string, to: string, promotion?: string) => void;
}

export default function PuzzleBoard({ fen, flipped = false, disabled = false, lastMove, hintSquare, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const board = parseFen(fen);
  const turn = fen.split(' ')[1];
  const targets = selected ? getLegalTargets(fen, selected) : [];
  const checked = getCheckedKingSquare(fen);

  useEffect(() => { setSelected(null); setPromo(null); }, [fen]);

  const isOwn = (p: string | null) => !!p && (turn === 'w' ? p === p.toUpperCase() : p === p.toLowerCase());

  function pieceAt(sqName: string) {
    return board[8 - parseInt(sqName[1], 10)][FILES.indexOf(sqName[0])];
  }

  function tryMove(from: string, to: string) {
    if (!getLegalTargets(fen, from).includes(to)) { setSelected(null); return; }
    const p = pieceAt(from);
    if (p && p.toUpperCase() === 'P' && (to[1] === '8' || to[1] === '1')) {
      setPromo({ from, to });
      return;
    }
    setSelected(null);
    onMove(from, to);
  }

  function click(sqName: string) {
    if (disabled) return;
    const p = pieceAt(sqName);
    if (selected && selected !== sqName && !isOwn(p)) { tryMove(selected, sqName); return; }
    setSelected(isOwn(p) && selected !== sqName ? sqName : null);
  }

  const rows = flipped ? [...board.keys()].reverse() : [...board.keys()];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="relative w-full max-w-[520px] aspect-square mx-auto select-none">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg overflow-hidden shadow-lg">
        {rows.map(r => cols.map(f => {
          const sqName = FILES[f] + String(8 - r);
          const piece = board[r][f];
          const light = (f + r) % 2 === 0;
          const isLast = lastMove && (lastMove.from === sqName || lastMove.to === sqName);
          return (
            <div
              key={sqName}
              onClick={() => click(sqName)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (selected && !disabled) tryMove(selected, sqName); }}
              className={`relative flex items-center justify-center ${light ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'} ${disabled ? '' : 'cursor-pointer'}`}
            >
              {isLast && <div className="absolute inset-0 bg-yellow-300/40" />}
              {selected === sqName && <div className="absolute inset-0 bg-emerald-400/50" />}
              {checked === sqName && <div className="absolute inset-0 bg-red-500/50" />}
              {hintSquare === sqName && <div className="absolute inset-0 ring-4 ring-inset ring-blue-500" />}
              {targets.includes(sqName) && (
                <div className={`absolute rounded-full bg-black/25 ${piece ? 'inset-1 bg-transparent border-4 border-black/25' : 'w-1/3 h-1/3'}`} />
              )}
              {piece && (
                <img
                  src={`/chess-pieces/${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}.svg`}
                  alt={piece}
                  className="relative w-[88%] h-[88%] select-none"
                  draggable={!disabled && isOwn(piece)}
                  onDragStart={() => { if (!disabled && isOwn(piece)) setSelected(sqName); }}
                />
              )}
            </div>
          );
        }))}
      </div>
      {promo && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center gap-3">
          {['Q', 'R', 'B', 'N'].map(p => (
            <button
              key={p}
              className="bg-white rounded-lg p-2 w-16 h-16 hover:bg-emerald-100"
              onClick={() => { const m = promo; setPromo(null); setSelected(null); onMove(m.from, m.to, p.toLowerCase()); }}
            >
              <img src={`/chess-pieces/${turn}${p}.svg`} alt={p} className="w-full h-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

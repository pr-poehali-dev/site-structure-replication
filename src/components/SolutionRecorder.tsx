import PuzzleBoard from '@/components/PuzzleBoard';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { isValidFen, replaySolution } from '@/lib/puzzles';

interface Props {
  fen: string;
  solution: string;
  onChange: (solution: string) => void;
}

export default function SolutionRecorder({ fen, solution, onChange }: Props) {
  const cleanFen = fen.trim().replace(/\s+/g, ' ');
  if (!isValidFen(cleanFen)) {
    return <p className="text-sm text-gray-400">Вставьте позицию (FEN), и здесь появится доска для записи решения.</p>;
  }

  const moves = solution.split(' ').filter(Boolean);
  const current = replaySolution(cleanFen, moves);
  const last = moves[moves.length - 1];
  const startsBlack = cleanFen.split(' ')[1] === 'b';

  function add(from: string, to: string, promotion?: string) {
    onChange([...moves, from + to + (promotion || '')].join(' '));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Играйте ходы на доске по очереди: сначала ход решающего, затем ответ соперника, и так до конца решения.
      </p>
      <div className="max-w-[420px] w-full">
        <PuzzleBoard
          fen={current}
          flipped={startsBlack}
          lastMove={last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null}
          onMove={add}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!moves.length} onClick={() => onChange(moves.slice(0, -1).join(' '))}>
          <Icon name="Undo2" size={14} className="mr-1" />Отменить ход
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!moves.length} onClick={() => onChange('')}>
          <Icon name="RotateCcw" size={14} className="mr-1" />Начать заново
        </Button>
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
        <span className="text-gray-400">Записано в верный ответ: </span>
        {moves.length ? (
          <span className="font-mono font-medium text-gray-800">{moves.map((m, i) => `${i + 1}. ${m.slice(0, 2)}-${m.slice(2, 4)}${m.slice(4) ? '=' + m.slice(4).toUpperCase() : ''}`).join('  ')}</span>
        ) : (
          <span className="text-gray-400">пока нет ходов</span>
        )}
      </div>
    </div>
  );
}

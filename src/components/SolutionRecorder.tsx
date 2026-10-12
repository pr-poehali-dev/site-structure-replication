import { useEffect, useState } from 'react';
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
  const [flip, setFlip] = useState(false);
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  const movesCount = solution.split(' ').filter(Boolean).length;

  useEffect(() => {
    if (replayStep === null) return;
    if (replayStep >= movesCount) {
      setReplayDone(true);
      setReplayStep(null);
      return;
    }
    const t = setTimeout(() => setReplayStep(replayStep + 1), 800);
    return () => clearTimeout(t);
  }, [replayStep, movesCount]);

  useEffect(() => { setReplayStep(null); setReplayDone(false); }, [solution, fen]);

  const cleanFen = fen.trim().replace(/\s+/g, ' ');
  if (!isValidFen(cleanFen)) {
    return <p className="text-sm text-gray-400">Вставьте позицию (FEN), и здесь появится доска для записи решения.</p>;
  }

  const moves = solution.split(' ').filter(Boolean);
  const shown = replayStep !== null ? moves.slice(0, replayStep) : moves;
  const current = replaySolution(cleanFen, shown);
  const last = shown[shown.length - 1];
  const replaying = replayStep !== null;
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
          flipped={startsBlack !== flip}
          lastMove={last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null}
          disabled={replaying}
          onMove={add}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!moves.length || replaying} onClick={() => { setReplayDone(false); setReplayStep(0); }}>
          <Icon name="Play" size={14} className="mr-1" />Проверить решение
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setFlip(f => !f)}>
          <Icon name="ArrowUpDown" size={14} className="mr-1" />Перевернуть доску
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!moves.length || replaying} onClick={() => onChange(moves.slice(0, -1).join(' '))}>
          <Icon name="Undo2" size={14} className="mr-1" />Отменить ход
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!moves.length || replaying} onClick={() => onChange('')}>
          <Icon name="RotateCcw" size={14} className="mr-1" />Начать заново
        </Button>
      </div>
      {replaying && <p className="text-sm text-blue-600">Проигрываем решение: ход {Math.min(replayStep + 1, movesCount)} из {movesCount}</p>}
      {replayDone && <p className="text-sm text-emerald-600">Решение проиграно полностью: {movesCount} ход(ов), ошибок нет.</p>}
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

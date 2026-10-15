import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shortFio } from '@/lib/fio';

const LILA_ORIGIN = 'https://play.мир-шахмат.рф';

interface Props {
  gameId: string | null;
  myColor?: 'white' | 'black';
  opponentFio?: string | null;
  onClose: () => void;
}

export default function LilaGameDialog({ gameId, myColor, opponentFio, onClose }: Props) {
  const side = myColor === 'black' ? '/black' : '';
  return (
    <Dialog open={!!gameId} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-[96vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {myColor ? `${myColor === 'white' ? 'Белыми' : 'Чёрными'} против ${shortFio(opponentFio) || 'соперника'}` : 'Партия'}
          </DialogTitle>
        </DialogHeader>
        {gameId && (
          <iframe
            key={gameId}
            title="Партия в Lila"
            src={`${LILA_ORIGIN}/embed/game/${gameId}${side}?theme=auto&bg=auto`}
            className="w-full h-[70vh] min-h-[420px] rounded-lg border border-gray-100 bg-white"
            allowFullScreen
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

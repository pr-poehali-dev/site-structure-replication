import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { CHESS_GAME_URL } from './adminTypes';

interface ResetDemoGameButtonProps {
  password: string;
}

// Служебная статичная партия t1 vs t2 (см. src/pages/cabinet/ProfileSection.tsx) — используется
// для быстрой проверки игровой механики. Игроки и контроль времени (5+3) заданы один раз при
// создании партии в БД, здесь только сбрасываем её к начальной позиции.
const DEMO_GAME_ID = 124;
const DEMO_GAME_BASE_MS = 5 * 60000;

export default function ResetDemoGameButton({ password }: ResetDemoGameButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!confirm('Сбросить тестовую партию t1 vs t2 к начальной позиции? Текущие ходы и чат партии будут удалены.')) return;
    setLoading(true);
    try {
      const res = await fetch(CHESS_GAME_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ _action: 'admin_reset', game_id: DEMO_GAME_ID, base_ms: DEMO_GAME_BASE_MS }),
      });
      if (res.ok) {
        toast.success('Тестовая партия сброшена');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Не удалось сбросить партию');
      }
    } catch {
      toast.error('Не удалось сбросить партию');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
      onClick={handleReset} disabled={loading} title="Сбросить тестовую партию t1 vs t2 к начальной позиции">
      <Icon name={loading ? 'Loader2' : 'RotateCcw'} size={16} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Сбросить тест-партию
    </Button>
  );
}

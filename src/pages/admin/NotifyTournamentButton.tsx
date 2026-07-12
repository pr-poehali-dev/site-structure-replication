import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Tournament, NOTIFY_TOURNAMENT_URL } from './adminTypes';

interface NotifyTournamentButtonProps {
  password: string;
  tournament: Tournament;
}

export default function NotifyTournamentButton({ password, tournament }: NotifyTournamentButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(NOTIFY_TOURNAMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({
          tournament_id: tournament.id,
          tournament_title: tournament.title,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Не удалось отправить уведомление');
        return;
      }
      if (data.total === 0) {
        toast.warning('Пока никто не подписан на уведомления о турнирах');
      } else {
        toast.success(`Уведомление отправлено: ${data.sent} из ${data.total}`);
      }
      setOpen(false);
      setMessage('');
    } catch {
      toast.error('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon name="BellRing" size={14} className="mr-1" /> Уведомить клиентов
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Уведомить клиентов о турнире</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">«{tournament.title}»</p>
        <Textarea
          placeholder="Текст уведомления (необязательно). Например: Открыта регистрация, осталось мало мест!"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Отмена</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Отправка...' : 'Отправить уведомление'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

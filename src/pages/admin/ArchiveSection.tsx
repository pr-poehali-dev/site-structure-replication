import { Application, Tournament, STATUS_COLORS, STATUS_LABELS, TOURNAMENTS_URL } from './adminTypes';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface ArchiveSectionProps {
  password: string;
  tournaments: Tournament[];
  apps: Application[];
  tLoading: boolean;
  fetchTournaments: () => Promise<void>;
}

export default function ArchiveSection({ password, tournaments, apps, tLoading, fetchTournaments }: ArchiveSectionProps) {
  const archived = tournaments.filter(t => t.status === 'archived');
  const [editT, setEditT] = useState<Tournament | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openEdit(t: Tournament) {
    setEditT(t);
    setForm({
      title: t.title || '',
      description: t.description || '',
      date: t.date ? t.date.slice(0, 10) : '',
      location: t.location || '',
      age_category: t.age_category || '',
      price: t.price != null ? String(t.price) : '',
      time_control: t.time_control || '',
      time_msk: t.time_msk || '',
      rounds_count: t.rounds_count != null ? String(t.rounds_count) : '5',
      max_participants: t.max_participants != null ? String(t.max_participants) : '',
      admin_message: t.admin_message || '',
      lila_tournament_ref: t.lila_tournament_id || '',
      lila_tournament_password: t.lila_tournament_password || '',
    });
  }

  function setField(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editT) return;
    setSaving(true);
    try {
      const res = await fetch(TOURNAMENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({
          ...form,
          price: form.price ? parseFloat(form.price) : null,
          rounds_count: form.rounds_count ? parseInt(form.rounds_count, 10) : 5,
          max_participants: form.max_participants ? parseInt(form.max_participants, 10) : null,
          diploma_sample_url: editT.diploma_sample_url || '',
          regulation_url: editT.regulation_url || '',
          announcement_url: editT.announcement_url || '',
          hall_open: !!editT.hall_open,
          rating_type: editT.rating_type || 'rapid',
          tournament_type: editT.tournament_type || 'qualifying',
          _action: 'update',
          id: editT.id,
        }),
      });
      if (res.ok) {
        toast.success('Турнир сохранён');
        setEditT(null);
        fetchTournaments();
      } else {
        toast.error('Не удалось сохранить турнир');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(t: Tournament) {
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_status', id: t.id, status: 'closed' }),
    });
    fetchTournaments();
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить турнир из архива безвозвратно?')) return;
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchTournaments();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Archive" size={22} /> Архив турниров
        </h2>
      </div>

      {tLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
        : archived.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Archive" size={40} className="mx-auto mb-3 opacity-30" />
            <p>В архиве пока пусто</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {archived.map(t => {
              const tApps = apps.filter(a => a.tournament_id === t.id);
              return (
                <div key={t.id} className="bg-white rounded-2xl shadow p-5 opacity-90">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-lg text-primary">{t.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                          В архиве
                        </span>
                        {tApps.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {tApps.length} заявок
                          </span>
                        )}
                      </div>
                      {t.date && <p className="text-sm text-gray-500 mb-1">{new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                      {t.location && <p className="text-sm text-gray-500">{t.location}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                        <Icon name="Pencil" size={14} className="mr-1" /> Редактировать
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRestore(t)}>
                        <Icon name="ArchiveRestore" size={14} className="mr-1" /> Восстановить
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(t.id)}>
                        <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                      </Button>
                    </div>
                  </div>
                  {tApps.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Участники</p>
                      <div className="flex flex-col gap-1">
                        {tApps.map((a, i) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 w-5 shrink-0">{i + 1}.</span>
                            <span className="font-medium text-gray-800">{a.fio}</span>
                            {a.age && <span className="text-gray-400">· {a.age}</span>}
                            {a.country_city && <span className="text-gray-400">· {a.country_city}</span>}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[a.status] || a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      <Dialog open={!!editT} onOpenChange={o => !o && setEditT(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование турнира</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Название</Label>
              <Input required value={form.title || ''} onChange={e => setField('title', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Дата</Label>
              <Input type="date" value={form.date || ''} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Место</Label>
              <Input value={form.location || ''} onChange={e => setField('location', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Возрастная категория</Label>
              <Input value={form.age_category || ''} onChange={e => setField('age_category', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Стоимость</Label>
              <Input value={form.price || ''} onChange={e => setField('price', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Контроль времени</Label>
              <Input value={form.time_control || ''} onChange={e => setField('time_control', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Время (МСК)</Label>
              <Input value={form.time_msk || ''} onChange={e => setField('time_msk', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Туров</Label>
              <Input value={form.rounds_count || ''} onChange={e => setField('rounds_count', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Макс. участников</Label>
              <Input value={form.max_participants || ''} onChange={e => setField('max_participants', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Ссылка на Lila</Label>
              <Input value={form.lila_tournament_ref || ''} onChange={e => setField('lila_tournament_ref', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Пароль Lila</Label>
              <Input value={form.lila_tournament_password || ''} onChange={e => setField('lila_tournament_password', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label>Описание</Label>
              <Textarea rows={3} value={form.description || ''} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label>Сообщение от администратора</Label>
              <Textarea rows={2} value={form.admin_message || ''} onChange={e => setField('admin_message', e.target.value)} />
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditT(null)}>Отмена</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

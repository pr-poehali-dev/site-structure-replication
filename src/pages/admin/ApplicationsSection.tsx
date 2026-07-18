import { Dispatch, SetStateAction, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Tournament, Application, APPS_URL, STATUS_LABELS, STATUS_COLORS } from './adminTypes';

const EMPTY_NEW_APP = {
  tournament_id: '', fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', notes: '',
};

interface ApplicationsSectionProps {
  password: string;
  tournaments: Tournament[];
  apps: Application[];
  appsLoading: boolean;
  editApp: Application | null;
  setEditApp: Dispatch<SetStateAction<Application | null>>;
  editSaving: boolean;
  setEditSaving: Dispatch<SetStateAction<boolean>>;
  filterTournament: string;
  setFilterTournament: Dispatch<SetStateAction<string>>;
  fetchApps: () => Promise<void>;
}

export default function ApplicationsSection({
  password, tournaments, apps, appsLoading, editApp, setEditApp, editSaving, setEditSaving,
  filterTournament, setFilterTournament, fetchApps,
}: ApplicationsSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newApp, setNewApp] = useState(EMPTY_NEW_APP);
  const [creating, setCreating] = useState(false);

  async function handleCreateApp(e: React.FormEvent) {
    e.preventDefault();
    if (!newApp.tournament_id || !newApp.fio) return;
    setCreating(true);
    const tournament = tournaments.find(t => String(t.id) === newApp.tournament_id);
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        ...newApp,
        tournament_id: Number(newApp.tournament_id),
        tournament_title: tournament?.title || '',
        _action: 'create',
      }),
    });
    setCreating(false);
    setShowCreate(false);
    setNewApp(EMPTY_NEW_APP);
    fetchApps();
  }

  async function handleSaveApp(e: React.FormEvent) {
    e.preventDefault();
    if (!editApp) return;
    setEditSaving(true);
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ ...editApp, _action: 'update' }),
    });
    setEditSaving(false);
    setEditApp(null);
    fetchApps();
  }

  async function handleDeleteApp(id: number) {
    if (!confirm('Удалить заявку?')) return;
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchApps();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="ClipboardList" size={22} /> Заявки
        </h2>
        <div className="flex items-center gap-2">
          <select value={filterTournament} onChange={e => setFilterTournament(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Все турниры</option>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => fetchApps()} disabled={appsLoading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${appsLoading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Icon name="Plus" size={14} className="mr-1" /> Добавить заявку
          </Button>
        </div>
      </div>
      {appsLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
        : apps.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="ClipboardList" size={40} className="mx-auto mb-3 opacity-30" />
            <p>Заявок пока нет</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {apps.map(a => (
              <div key={a.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-base text-primary">{a.fio}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </div>
                  <p className="text-sm text-secondary font-medium mb-2">{a.tournament_title}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-500">
                    {a.age && <span><b>Возраст:</b> {a.age}</span>}
                    {a.fsr_id && <span><b>ФШР:</b> {a.fsr_id}</span>}
                    {a.coach && <span><b>Тренер:</b> {a.coach}</span>}
                    {a.country_city && <span><b>Город:</b> {a.country_city}</span>}
                    {a.school && <span><b>Учебное зав.:</b> {a.school}</span>}
                    {a.email && <span><b>Email:</b> {a.email}</span>}
                    {a.phone && <span><b>Тел.:</b> {a.phone}</span>}
                  </div>
                  {a.notes && <p className="mt-2 text-sm text-gray-500 italic">💬 {a.notes}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleString('ru-RU')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditApp({ ...a })}>
                    <Icon name="Pencil" size={14} className="mr-1" /> Изменить
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteApp(a.id)}>
                    <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Модал создания заявки администратором */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Добавить заявку</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleCreateApp} className="flex flex-col gap-3">
              <div>
                <Label>Турнир</Label>
                <select required value={newApp.tournament_id} onChange={e => setNewApp({ ...newApp, tournament_id: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Выберите турнир</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div><Label>ФИО участника</Label><Input required className="mt-1" value={newApp.fio} onChange={e => setNewApp({ ...newApp, fio: e.target.value })} /></div>
              <div><Label>Возраст</Label><Input className="mt-1" value={newApp.age} onChange={e => setNewApp({ ...newApp, age: e.target.value })} /></div>
              <div><Label>ID ФШР</Label><Input className="mt-1" value={newApp.fsr_id} onChange={e => setNewApp({ ...newApp, fsr_id: e.target.value })} /></div>
              <div><Label>ФИО тренера</Label><Input className="mt-1" value={newApp.coach} onChange={e => setNewApp({ ...newApp, coach: e.target.value })} /></div>
              <div><Label>Страна / Город</Label><Input className="mt-1" value={newApp.country_city} onChange={e => setNewApp({ ...newApp, country_city: e.target.value })} /></div>
              <div><Label>Учебное заведение</Label><Input className="mt-1" value={newApp.school} onChange={e => setNewApp({ ...newApp, school: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" className="mt-1" value={newApp.email} onChange={e => setNewApp({ ...newApp, email: e.target.value })} /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={newApp.phone} onChange={e => setNewApp({ ...newApp, phone: e.target.value })} /></div>
              <div><Label>Заметки</Label><Textarea className="mt-1" rows={3} value={newApp.notes} onChange={e => setNewApp({ ...newApp, notes: e.target.value })} placeholder="Внутренние заметки..." /></div>
              <p className="text-xs text-gray-400">Заявка будет создана со статусом «Оплачена»</p>
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
                <Button type="submit" disabled={creating}>{creating ? 'Создание...' : 'Создать заявку'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал редактирования заявки */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование заявки</h2>
              <button onClick={() => setEditApp(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSaveApp} className="flex flex-col gap-3">
              <div><Label>ФИО участника</Label><Input className="mt-1" value={editApp.fio} onChange={e => setEditApp({ ...editApp, fio: e.target.value })} /></div>
              <div><Label>Возраст</Label><Input className="mt-1" value={editApp.age} onChange={e => setEditApp({ ...editApp, age: e.target.value })} /></div>
              <div><Label>ID ФШР</Label><Input className="mt-1" value={editApp.fsr_id} onChange={e => setEditApp({ ...editApp, fsr_id: e.target.value })} /></div>
              <div><Label>ФИО тренера</Label><Input className="mt-1" value={editApp.coach} onChange={e => setEditApp({ ...editApp, coach: e.target.value })} /></div>
              <div><Label>Страна / Город</Label><Input className="mt-1" value={editApp.country_city} onChange={e => setEditApp({ ...editApp, country_city: e.target.value })} /></div>
              <div><Label>Учебное заведение</Label><Input className="mt-1" value={editApp.school} onChange={e => setEditApp({ ...editApp, school: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" className="mt-1" value={editApp.email} onChange={e => setEditApp({ ...editApp, email: e.target.value })} /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={editApp.phone} onChange={e => setEditApp({ ...editApp, phone: e.target.value })} /></div>
              <div>
                <Label>Статус</Label>
                <select value={editApp.status} onChange={e => setEditApp({ ...editApp, status: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="new">Новая</option>
                  <option value="pending_payment">Ждёт оплаты</option>
                  <option value="confirmed">Подтверждена</option>
                  <option value="paid">Оплачена</option>
                  <option value="cancelled">Отменена</option>
                </select>
              </div>
              <div><Label>Заметки</Label><Textarea className="mt-1" rows={3} value={editApp.notes || ''} onChange={e => setEditApp({ ...editApp, notes: e.target.value })} placeholder="Внутренние заметки..." /></div>
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setEditApp(null)}>Отмена</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
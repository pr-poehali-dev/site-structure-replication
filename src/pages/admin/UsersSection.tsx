import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { UserAccount, AUTH_URL } from './adminTypes';

interface UsersSectionProps {
  password: string;
}

function initials(lastName: string, firstName: string) {
  return [lastName?.[0], firstName?.[0]].filter(Boolean).join('').toUpperCase();
}

export default function UsersSection({ password }: UsersSectionProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [ratingBlitz, setRatingBlitz] = useState('');
  const [ratingRapid, setRatingRapid] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async (q = '') => {
    setLoading(true);
    const url = q ? `${AUTH_URL}?search=${encodeURIComponent(q)}` : AUTH_URL;
    const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, [password]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openEdit(u: UserAccount) {
    setEditUser(u);
    setRatingBlitz(u.rating_blitz != null ? String(u.rating_blitz) : '');
    setRatingRapid(u.rating_rapid != null ? String(u.rating_rapid) : '');
  }

  async function handleSaveRatings(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        _action: 'update_ratings',
        user_id: editUser.id,
        rating_blitz: ratingBlitz ? Number(ratingBlitz) : null,
        rating_rapid: ratingRapid ? Number(ratingRapid) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Рейтинги обновлены');
      setEditUser(null);
      fetchUsers(search);
    } else {
      toast.error('Не удалось сохранить рейтинги');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Users" size={22} /> Участники
        </h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Поиск по имени или email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsers(search)}
            className="w-56"
          />
          <Button variant="outline" size="sm" onClick={() => fetchUsers(search)} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="Users" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Участники не найдены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow p-5 flex items-center gap-4 flex-wrap">
              <Avatar className="w-12 h-12 shrink-0">
                <AvatarImage src={u.avatar_url || undefined} alt={u.first_name} />
                <AvatarFallback className="bg-primary text-white font-heading font-bold">
                  {initials(u.last_name, u.first_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-primary">{u.last_name} {u.first_name} {u.middle_name || ''}</p>
                <p className="text-sm text-gray-400">{u.email}</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Блиц</p>
                  <p className="font-bold text-primary">{u.rating_blitz ?? '—'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Рапид</p>
                  <p className="font-bold text-primary">{u.rating_rapid ?? '—'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEdit(u)} className="shrink-0">
                <Icon name="Pencil" size={14} className="mr-1" /> Рейтинги
              </Button>
            </div>
          ))}
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Рейтинги</h2>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{editUser.last_name} {editUser.first_name}</p>
            <form onSubmit={handleSaveRatings} className="flex flex-col gap-3">
              <div>
                <Label>Рейтинг Блиц</Label>
                <Input type="number" className="mt-1" value={ratingBlitz} onChange={e => setRatingBlitz(e.target.value)} placeholder="Например: 1450" />
              </div>
              <div>
                <Label>Рейтинг Рапид</Label>
                <Input type="number" className="mt-1" value={ratingRapid} onChange={e => setRatingRapid(e.target.value)} placeholder="Например: 1520" />
              </div>
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditUser(null)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

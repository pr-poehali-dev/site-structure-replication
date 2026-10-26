import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const AUTH_URL = func2url['auth'];
const OWNER_ID = 173;

interface Found { id: number; last_name: string; first_name: string; email: string; login: string | null }

export default function ImpersonatePanel() {
  const { user, token, impersonating, startImpersonation } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.id !== OWNER_ID || impersonating) return null;

  async function search(value: string) {
    setQ(value);
    if (value.trim().length < 2) { setList([]); return; }
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
      body: JSON.stringify({ _action: 'impersonate_search', q: value }),
    });
    const data = await res.json();
    setList(data.users || []);
  }

  async function enter(id: number) {
    setBusy(true);
    setError('');
    const r = await startImpersonation(id);
    if (r.ok === false) setError(r.error);
    else window.location.href = '/cabinet';
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-secondary/40 shadow-sm p-5">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Icon name="UserCog" size={16} /> Войти как другой пользователь
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700">Найдите участника по фамилии, имени, логину или почте</p>
          <Input value={q} onChange={e => search(e.target.value)} placeholder="Например, Иванов" autoFocus />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col divide-y divide-gray-100">
            {list.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-800 truncate">{u.last_name} {u.first_name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.login || ''} {u.email}</p>
                </div>
                <Button size="sm" disabled={busy} onClick={() => enter(u.id)}>Войти</Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

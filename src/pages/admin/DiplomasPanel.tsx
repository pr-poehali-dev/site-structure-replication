import { useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { ELECTRONIC_RESULTS_URL, NOMINATIONS, ResultRow, ResultFile } from '@/lib/electronicResults';

interface Props {
  tournamentId: number;
  password: string;
  players: ResultRow[];
  nominees: { username: string; fio: string; kind: string; label: string }[];
  files: ResultFile[];
  onChanged: () => void;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Slot({ label, file, busy, onPick, onRemove }: {
  label: string; file?: ResultFile; busy: boolean; onPick: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 text-xs">
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      {file ? (
        <>
          <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline flex items-center gap-1">
            <Icon name="FileCheck" size={13} /> Загружен
          </a>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="text-gray-500 hover:text-gray-800 underline">Заменить</button>
          <button type="button" disabled={busy} onClick={onRemove} className="text-red-500 hover:text-red-700"><Icon name="Trash2" size={13} /></button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="px-2.5 py-1 rounded-md border border-gray-300 hover:border-secondary text-gray-700 flex items-center gap-1">
          {busy ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Upload" size={12} />} Загрузить
        </button>
      )}
    </div>
  );
}

export default function DiplomasPanel({ tournamentId, password, players, nominees, files, onChanged }: Props) {
  const [busyKey, setBusyKey] = useState('');

  const find = (username: string, kind: string) =>
    files.find(f => f.username.toLowerCase() === username.toLowerCase() && f.kind === kind);

  async function post(body: object) {
    const res = await fetch(ELECTRONIC_RESULTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ tournament_id: tournamentId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка');
  }

  async function upload(username: string, kind: string, file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error('Файл больше 8 МБ'); return; }
    const key = username + kind;
    setBusyKey(key);
    try {
      await post({ _action: 'upload_file', username, kind, content_type: file.type, file_name: file.name, file_b64: await toBase64(file) });
      toast.success('Файл загружен');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить');
    }
    setBusyKey('');
  }

  async function remove(username: string, kind: string) {
    setBusyKey(username + kind);
    try {
      await post({ _action: 'delete_file', username, kind });
      onChanged();
    } catch {
      toast.error('Не удалось удалить');
    }
    setBusyKey('');
  }

  const realPlayers = players.filter(p => p.user_id !== null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-heading font-bold text-base text-primary mb-1">Дипломы и благодарственные письма</h3>
      <p className="text-xs text-gray-400 mb-4">Форматы PDF, PNG, JPG, до 8 МБ. Участник увидит кнопки скачивания в личном кабинете после публикации результатов. Для номинаций сначала выберите победителей выше и нажмите «Сохранить».</p>

      {nominees.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">Дипломы в номинациях</p>
          <div className="flex flex-col gap-3">
            {nominees.map(n => {
              const kind = `nom_${n.kind}`;
              return (
                <div key={n.username + n.kind} className="rounded-lg border border-gray-100 px-3 py-2">
                  <p className="text-sm text-gray-800 mb-1.5">{n.fio} <span className="text-gray-400">— {n.label}</span></p>
                  <Slot label="Диплом номинации" file={find(n.username, kind)} busy={busyKey === n.username + kind}
                    onPick={f => upload(n.username, kind, f)} onRemove={() => remove(n.username, kind)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-sm font-semibold text-gray-700 mb-2">Участники ({realPlayers.length})</p>
      {realPlayers.length === 0 ? (
        <p className="text-sm text-gray-400">Нет участников с аккаунтом на сайте</p>
      ) : (
        <div className="flex flex-col gap-3">
          {realPlayers.map(p => (
            <div key={p.username} className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-sm text-gray-800 mb-1.5">{p.rank}. {p.fio}</p>
              <div className="flex flex-col gap-1.5">
                <Slot label="Диплом" file={find(p.username, 'diploma')} busy={busyKey === p.username + 'diploma'}
                  onPick={f => upload(p.username, 'diploma', f)} onRemove={() => remove(p.username, 'diploma')} />
                <Slot label="Благодарность" file={find(p.username, 'thanks')} busy={busyKey === p.username + 'thanks'}
                  onPick={f => upload(p.username, 'thanks', f)} onRemove={() => remove(p.username, 'thanks')} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { NOMINATIONS };

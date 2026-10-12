import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import MiniChessBoard from '@/components/MiniChessBoard';
import SolutionRecorder from '@/components/SolutionRecorder';
import { PUZZLES_URL, AdminPuzzle, DIFFICULTY_LABELS } from '@/lib/puzzles';

interface Props { password: string }

const EMPTY = { id: 0, title: '', fen: '', solution: '', difficulty: 1, theme: '', hint: '' };

export default function PuzzlesAdminSection({ password }: Props) {
  const [items, setItems] = useState<AdminPuzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = { 'Content-Type': 'application/json', 'X-Admin-Password': password };

  function load() {
    setLoading(true);
    fetch(`${PUZZLES_URL}?admin=1`, { headers })
      .then(r => r.json())
      .then(d => setItems(d.puzzles || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function post(body: object) {
    const res = await fetch(PUZZLES_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.solution.trim()) { toast.error('Сыграйте верный ответ на доске'); return; }
    setSaving(true);
    const { ok, data } = await post({ _action: form.id ? 'update' : 'create', ...form });
    setSaving(false);
    if (!ok) { toast.error(data.error || 'Не удалось сохранить'); return; }
    toast.success('Задача сохранена');
    setForm(null);
    load();
  }

  async function importFile(file: File) {
    setImporting(true);
    const pgn = await file.text();
    const { ok, data } = await post({ _action: 'import_pgn', pgn });
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!ok) { toast.error(data.error || 'Не удалось загрузить файл'); return; }
    toast.success(`Добавлено задач: ${data.created}`);
    if (data.errors?.length) toast.error(data.errors.slice(0, 3).join('\n'));
    load();
  }

  async function act(action: 'toggle' | 'delete', id: number) {
    if (action === 'delete' && !confirm('Удалить задачу вместе с результатами решений?')) return;
    await post({ _action: action, id });
    load();
  }

  if (form) {
    return (
      <form onSubmit={save} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 max-w-2xl">
        <h2 className="font-heading font-bold text-xl text-primary">{form.id ? 'Редактировать задачу' : 'Новая задача'}</h2>
        <div><Label>Название *</Label><Input required className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div>
          <Label>Позиция (FEN) *</Label>
          <Input required className="mt-1 font-mono text-xs" placeholder="6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1" value={form.fen} onChange={e => setForm({ ...form, fen: e.target.value, solution: '' })} />
                  </div>
        <div>
          <Label>Верный ответ *</Label>
          <div className="mt-2"><SolutionRecorder fen={form.fen} solution={form.solution} onChange={solution => setForm({ ...form, solution })} /></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Сложность</Label>
            <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d} — {DIFFICULTY_LABELS[d]}</option>)}
            </select>
          </div>
          <div><Label>Тема</Label><Input className="mt-1" placeholder="Мат в 2 хода" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} /></div>
          <div><Label>Подсказка</Label><Input className="mt-1" value={form.hint} onChange={e => setForm({ ...form, hint: e.target.value })} /></div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">{saving ? 'Сохраняем...' : 'Сохранить'}</Button>
          <Button type="button" variant="outline" onClick={() => setForm(null)}>Отмена</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-heading font-bold text-xl text-primary">Задачи ({items.length})</h2>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".pgn,text/plain" className="hidden" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
            <Icon name={importing ? 'Loader2' : 'Upload'} size={15} className={`mr-2 ${importing ? 'animate-spin' : ''}`} />Загрузить PGN
          </Button>
          <Button onClick={() => setForm(EMPTY)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90"><Icon name="Plus" size={15} className="mr-2" />Добавить задачу</Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">В PGN у каждой задачи должен быть заголовок [FEN "..."], а ходы решения идут как в обычной партии. По желанию: [Event] — название, [Difficulty] — сложность 1–5, [Theme], [Hint].</p>
      {loading ? (
        <Icon name="Loader2" size={20} className="animate-spin text-gray-400" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">Задач пока нет</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(p => (
            <div key={p.id} className={`flex items-center gap-3 border rounded-xl p-3 ${p.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <MiniChessBoard fen={p.fen} size={64} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{DIFFICULTY_LABELS[p.difficulty]}{p.theme ? ` · ${p.theme}` : ''} · решили: {p.solves}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setForm({ id: p.id, title: p.title, fen: p.fen, solution: p.solution, difficulty: p.difficulty, theme: p.theme || '', hint: p.hint || '' })}><Icon name="Pencil" size={15} /></Button>
              <Button variant="ghost" size="sm" onClick={() => act('toggle', p.id)} title={p.is_active ? 'Скрыть' : 'Показать'}><Icon name={p.is_active ? 'Eye' : 'EyeOff'} size={15} /></Button>
              <Button variant="ghost" size="sm" onClick={() => act('delete', p.id)}><Icon name="Trash2" size={15} className="text-red-500" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

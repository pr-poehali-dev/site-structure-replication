import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

const LILA_ORIGIN = 'https://play.мир-шахмат.рф';

function parseRef(value: string): { kind: 'swiss' | 'tournament'; id: string } {
  const m = value.match(/(swiss|tournament)\/([A-Za-z0-9_-]+)/);
  if (m) return { kind: m[1] as 'swiss' | 'tournament', id: m[2] };
  return { kind: 'swiss', id: value.trim() };
}

export default function TestEmbed() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('id') || '');
  const [height, setHeight] = useState(850);
  const kindParam = params.get('kind') === 'tournament' ? 'tournament' : 'swiss';
  const tournamentId = parseRef(params.get('id') || '').id;
  const src = tournamentId ? `${LILA_ORIGIN}/embed/${kindParam}/${tournamentId}` : '';

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const { kind, id } = parseRef(input);
    if (id) setParams({ id, kind });
  }

  return (
    <div className="min-h-screen bg-muted">
      <Seo title="Тест турнира в Lila" description="Тестовая страница" noindex />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-2xl text-primary">Тест: турнир Lila внутри сайта</h1>
          <Link to="/" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icon name="ArrowLeft" size={14} /> На главную
          </Link>
        </div>

        <form onSubmit={apply} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <Label htmlFor="lila-id">Номер или ссылка турнира на Lila</Label>
            <Input id="lila-id" className="mt-1" placeholder="AbCdEfGh или https://play.мир-шахмат.рф/swiss/AbCdEfGh" value={input} onChange={e => setInput(e.target.value)} />
          </div>
          <div className="sm:w-32">
            <Label htmlFor="lila-h">Высота, px</Label>
            <Input id="lila-h" type="number" min={400} max={2000} step={50} className="mt-1" value={height} onChange={e => setHeight(Number(e.target.value) || 850)} />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm px-5 h-10 hover:opacity-90 transition-opacity">
            <Icon name="Eye" size={16} /> Показать
          </button>
        </form>

        {!user && (
          <p className="text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
            Вы не вошли на сайт, поэтому в окне турнира вы тоже будете гостем.{' '}
            <Link to="/login" className="font-semibold underline">Войти</Link>
          </p>
        )}

        {src && (
          <p className="text-xs text-gray-500 break-all">
            Адрес окна: {src}
          </p>
        )}

        {src ? (
          <iframe
            key={src}
            src={src}
            title="Турнир Lila"
            width="100%"
            height={height}
            style={{ border: '1px solid #E5E2DC', borderRadius: 12, background: '#fff' }}
            allow="fullscreen; clipboard-write"
          />
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
            Введите номер турнира, и он появится здесь
          </div>
        )}
      </div>
    </div>
  );
}

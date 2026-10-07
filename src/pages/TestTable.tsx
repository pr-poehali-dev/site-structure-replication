import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import LilaStandings from '@/components/LilaStandings';

export default function TestTable() {
  return (
    <div className="min-h-screen bg-muted">
      <Seo title="Тест таблицы турнира" description="Тестовая страница" noindex />
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-2xl text-primary">Тест: таблица турнира из Lila</h1>
          <Link to="/" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icon name="ArrowLeft" size={14} /> На главную
          </Link>
        </div>
        <LilaStandings tournamentId="V2yVTHUs" />
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';

export default function TestEmbed3() {
  return (
    <div className="min-h-screen bg-muted">
      <Seo title="Тест турнира в Lila 3" description="Тестовая страница" noindex />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-2xl text-primary">Тест 3: страница турнира с параметром embed=1</h1>
          <Link to="/" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icon name="ArrowLeft" size={14} /> На главную
          </Link>
        </div>

        <iframe
          src="https://play.мир-шахмат.рф/swiss/bAZSL38w?embed=1"
          title="Шахматный турнир"
          width="100%"
          height={850}
          style={{ border: '1px solid #E5E2DC', borderRadius: 12, background: '#fff' }}
        />
      </div>
    </div>
  );
}

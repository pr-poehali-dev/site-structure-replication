import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';

export default function TestEmbed2() {
  return (
    <div className="min-h-screen bg-muted">
      <Seo title="Тест турнира в Lila 2" description="Тестовая страница" noindex />
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-2xl text-primary">Тест 2: обычная страница турнира со сдвигом</h1>
          <Link to="/" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icon name="ArrowLeft" size={14} /> На главную
          </Link>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '850px', overflow: 'hidden', border: '1px solid #E5E2DC', borderRadius: '12px', background: '#fff' }}>
          <iframe
            src="https://play.мир-шахмат.рф/swiss/bAZSL38w"
            style={{ position: 'absolute', top: '-100px', left: 0, width: '100%', height: 'calc(100% + 100px)', border: 'none' }}
            title="Шахматный турнир"
          />
        </div>
      </div>
    </div>
  );
}

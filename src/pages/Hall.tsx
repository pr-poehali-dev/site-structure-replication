import { useParams, Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function Hall() {
  const { tournamentId } = useParams();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo title="Турнирный зал" description="Турнирный зал" path={`/hall/${tournamentId}`} noindex />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Icon name="Swords" size={40} className="text-secondary mx-auto mb-4" />
          <h1 className="font-heading font-bold text-2xl text-primary mb-2">Турнирный зал скоро откроется</h1>
          <p className="text-gray-500 text-sm mb-6">Игровая доска, таблица и партии турнира появятся здесь в ближайшее время.</p>
          <Link to="/cabinet">
            <Button variant="outline"><Icon name="ArrowLeft" size={16} className="mr-2" /> Вернуться в кабинет</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

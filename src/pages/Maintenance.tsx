import Icon from '@/components/ui/icon';
import Seo from '@/components/Seo';

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <Seo title="Технические работы" description="Ведутся технические работы" noindex />
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-10">
        <Icon name="Wrench" size={44} className="text-secondary mx-auto mb-5" />
        <h1 className="font-heading font-bold text-2xl text-primary mb-3">
          Ведутся технические работы
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Мы делаем сайт лучше и удобнее!
        </p>
      </div>
    </div>
  );
}

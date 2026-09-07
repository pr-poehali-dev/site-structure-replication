import Icon from '@/components/ui/icon';
import PublicPushSubscribe from '@/components/PublicPushSubscribe';

export default function TurnirHero() {
  return (
    <section className="bg-primary text-white relative overflow-hidden">
      <div className="absolute inset-0 chess-grid opacity-40" />
      <div className="container relative px-4 py-10 md:py-14 max-w-4xl mx-auto text-center">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
          <Icon name="Trophy" size={15} /> Онлайн-регистрация
        </span>
        <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
          <span className="text-secondary">Турниры</span>
        </h1>
        <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
          Выберите турнир и подайте заявку на участие онлайн
        </p>
        <div className="mt-6 flex justify-center">
          <PublicPushSubscribe />
        </div>
      </div>
    </section>
  );
}

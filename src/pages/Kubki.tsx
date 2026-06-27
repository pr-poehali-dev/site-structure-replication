import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';

const Kubki = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 md:py-14 max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="Award" size={15} /> Награды для победителей
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            Заказать <span className="text-secondary">награды</span>
          </h1>
          <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
            Заказать наградную атрибутику можно по результатам турниров и олимпиад центра «Мир шахмат» — на основании итоговых протоколов соревнований.
          </p>
        </div>
      </section>

      {/* Content placeholder */}
      <section className="container px-4 py-16 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center text-muted-foreground">
          <Icon name="Award" size={48} className="opacity-30" />
          <p className="text-lg">Каталог наград скоро появится здесь</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Kubki;
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import ComingSoon from './cabinet/ComingSoon';

export default function Olimpiady() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo
        title="Олимпиады — Мир шахмат"
        description="Раздел олимпиад центра поддержки детского шахматного спорта «Мир шахмат» скоро появится."
        path="/olimpiady"
      />
      <Header />

      <section className="relative overflow-hidden bg-amber-50 flex-1">
        <div className="absolute inset-0 chess-grid opacity-60" />
        <div className="container relative px-4 py-14 max-w-2xl mx-auto">
          <h1 className="font-heading font-bold text-4xl md:text-5xl uppercase text-primary text-center mb-8">
            Олимпиады
          </h1>
          <ComingSoon
            icon="Medal"
            title="Скоро здесь появятся олимпиады"
            description="Мы готовим для вас олимпиады «Дебют», «Эврика» и «Эрудит». Совсем скоро раздел заработает!"
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}

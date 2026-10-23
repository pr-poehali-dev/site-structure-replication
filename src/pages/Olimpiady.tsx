import PageHeader from '@/components/PageHeader';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import ComingSoon from './cabinet/ComingSoon';

export default function Olimpiady() {
  return (
    <div className="min-h-screen bg-[#F3F7FF] text-foreground flex flex-col">
      <Seo
        title="Олимпиады — Мир шахмат"
        description="Раздел олимпиад центра поддержки детского шахматного спорта «Мир шахмат» скоро появится."
        path="/olimpiady"
      />
      <Header />

      <PageHeader icon="Medal" crumb="Олимпиады" title="Олимпиады" subtitle="Дебют, Эврика и Эрудит — онлайн-олимпиады для юных шахматистов" />
      <main className="flex-1 container px-4 py-8 max-w-2xl mx-auto">
        <ComingSoon
          icon="Medal"
          title="Скоро здесь появятся олимпиады"
          description="Мы готовим для вас олимпиады «Дебют», «Эврика» и «Эрудит». Совсем скоро раздел заработает!"
        />
      </main>

      <Footer />
    </div>
  );
}


import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Header, Footer } from '@/components/Layout';
import PublicPushSubscribe from '@/components/PublicPushSubscribe';
import Seo from '@/components/Seo';
import MostActive from '@/components/MostActive';
import QuickLinks from '@/components/home/QuickLinks';
import UpcomingTournaments from '@/components/home/UpcomingTournaments';
import OlympiadsAndPerks from '@/components/home/OlympiadsAndPerks';
import SidebarCards from '@/components/home/SidebarCards';
import TournamentInviteBanner from '@/components/home/TournamentInviteBanner';

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Мир шахмат — центр поддержки детского шахматного спорта"
        description="Турниры, фестивали и олимпиады по шахматам для детей. Дипломы, кубки и награды для юных шахматистов со всей России и стран СНГ."
        path="/"
      />
      <Header />
      <PublicPushSubscribe hideTrigger />

      <TournamentInviteBanner />

      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-gradient-to-br from-[#14224F] via-[#1B2F6B] to-[#0F1B3F]">
        <div className="absolute inset-0 chess-grid opacity-5" />
        <div className="absolute -top-10 -left-10 w-64 h-64 rounded-full bg-[#2DB86B]/30 blur-3xl animate-float" />
        <div className="absolute bottom-0 right-10 w-72 h-72 rounded-full bg-[#3D7BF7]/30 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="container relative grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-10 items-center px-4 py-5 max-md:py-0">
          <MostActive
            className="hidden md:flex"
            kinds={['month', 'all']}
            heading="Мир шахмат — центр поддержки детского шахматного спорта"
            note="Очки за участие в турнирах: разминочный — 1, тренировочный — 2, квалификационный — 3  (не зависит от результатов)"
            fallback={
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
              <Icon name="Sparkles" size={16} /> Центр поддержки детского шахматного спорта
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl leading-tight uppercase text-primary">
              Мир <span className="text-secondary">шахмат</span>
            </h1>
            <p className="mt-5 text-lg text-foreground/70 max-w-xl">
              Турниры, фестивали и праздники шахмат для детей. Мы растим чемпионов, развиваем мышление и дарим радость победы каждому юному игроку.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base h-12 px-7">
                <a href="/turnir"><Icon name="CalendarCheck" size={18} className="mr-2" /> Записаться на турнир</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 h-12 px-7 bg-transparent">
                <a href="/olimpiady">Олимпиады</a>
              </Button>
            </div>
          </div>
            }
          />
          <MostActive className="hidden md:flex" kinds={['blitz', 'rapid']} note="Рейтинг МШ — по итогам турниров «Мир шахмат»" />
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#EEF4FF] to-white">
        <div className="container px-4 py-6 flex flex-col gap-5">
          <QuickLinks />
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <UpcomingTournaments />
              <OlympiadsAndPerks />
            </div>
            <SidebarCards />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
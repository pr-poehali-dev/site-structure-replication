import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';

export default function Contacts() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo
        title="Контакты — Мир шахмат"
        description="Свяжитесь с центром поддержки детского шахматного спорта «Мир шахмат»: email, телефон, сайт и соцсети."
        path="/contacts"
      />
      <Header />

      <section className="relative overflow-hidden bg-amber-50 flex-1">
        <div className="absolute inset-0 chess-grid opacity-60" />
        <div className="container relative px-4 py-14 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-4">
              <Icon name="Phone" size={16} /> Мы на связи
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-5xl uppercase text-primary">
              Контакты
            </h1>
            <p className="mt-4 text-muted-foreground text-lg">
              Остались вопросы по турнирам, оплате или наградам? Напишите или позвоните нам.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-sm p-8 grid sm:grid-cols-2 gap-6">
            <a
              href="mailto:mir.shahmat@inbox.ru"
              className="flex items-center gap-4 rounded-xl border border-border p-5 hover:border-secondary hover:shadow-md transition-all"
            >
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-secondary/15 text-secondary shrink-0">
                <Icon name="Mail" size={22} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                <p className="font-semibold text-primary">mir.shahmat@inbox.ru</p>
              </div>
            </a>

            <a
              href="tel:+79922281068"
              className="flex items-center gap-4 rounded-xl border border-border p-5 hover:border-secondary hover:shadow-md transition-all"
            >
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-secondary/15 text-secondary shrink-0">
                <Icon name="Phone" size={22} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Телефон</p>
                <p className="font-semibold text-primary">8-99-222-810-68</p>
              </div>
            </a>

            <a
              href="https://мир-шахмат.рф"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border border-border p-5 hover:border-secondary hover:shadow-md transition-all"
            >
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-secondary/15 text-secondary shrink-0">
                <Icon name="Globe" size={22} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Сайт</p>
                <p className="font-semibold text-primary">мир-шахмат.рф</p>
              </div>
            </a>

            <a
              href="https://vk.com/mir.shahmat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border border-border p-5 hover:border-secondary hover:shadow-md transition-all"
            >
              <span className="grid place-items-center w-12 h-12 rounded-xl bg-secondary/15 text-secondary shrink-0">
                <Icon name="Users" size={22} />
              </span>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">ВКонтакте</p>
                <p className="font-semibold text-primary">vk.com/mir.shahmat</p>
              </div>
            </a>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-border shadow-sm p-8 text-center">
            <h2 className="font-heading font-bold text-xl uppercase text-primary mb-2">Организатор</h2>
            <p className="font-semibold text-primary">Мозжерин Илья Вячеславович</p>
            <p className="text-muted-foreground text-sm mt-1">ИНН: 591703749251</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

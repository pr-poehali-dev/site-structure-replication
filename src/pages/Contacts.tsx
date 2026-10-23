import PageHeader from '@/components/PageHeader';
import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';

export default function Contacts() {
  return (
    <div className="min-h-screen bg-[#F3F7FF] text-foreground flex flex-col">
      <Seo
        title="Контакты — Мир шахмат"
        description="Свяжитесь с центром поддержки детского шахматного спорта «Мир шахмат»: email, телефон, сайт и соцсети."
        path="/contacts"
      />
      <Header />

      <PageHeader icon="Phone" crumb="Контакты" title="Контакты" subtitle="Остались вопросы по турнирам, оплате или наградам? Напишите или позвоните нам." />
      <section className="flex-1">
        <div className="container relative px-4 py-8 max-w-3xl mx-auto">

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

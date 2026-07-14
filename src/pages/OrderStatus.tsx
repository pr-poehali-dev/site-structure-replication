import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';

const YOOKASSA_URL = 'https://functions.poehali.dev/6e82b6ca-7ab9-4c14-b655-024798e28cc1';
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 2000;

interface PendingOrder {
  order_number: string;
  order_id: number;
  payment_id: string;
  created_at: string;
}

type OrderState = 'checking' | 'paid' | 'pending' | 'canceled' | 'not_found';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function OrderStatus() {
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [state, setState] = useState<OrderState>('checking');
  const attemptsRef = useRef(0);

  useEffect(() => {
    const raw = localStorage.getItem('yookassa_pending_order');
    let parsed: PendingOrder | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
        setOrder(parsed);
      } catch {
        parsed = null;
      }
    }

    if (!parsed?.order_number) {
      setState('not_found');
      return;
    }

    let cancelled = false;

    async function poll() {
      while (!cancelled && attemptsRef.current < POLL_ATTEMPTS) {
        attemptsRef.current += 1;
        try {
          const res = await fetch(`${YOOKASSA_URL}?order_number=${encodeURIComponent(parsed!.order_number)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'paid') {
              if (!cancelled) setState('paid');
              localStorage.removeItem('yookassa_pending_order');
              return;
            }
            if (data.status === 'canceled') {
              if (!cancelled) setState('canceled');
              return;
            }
          } else if (res.status === 404) {
            if (!cancelled) setState('not_found');
            return;
          }
        } catch {
          // Пробуем ещё раз при сетевой ошибке
        }
        if (attemptsRef.current < POLL_ATTEMPTS) await sleep(POLL_DELAY_MS);
      }
      if (!cancelled) setState('pending');
    }

    poll();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo title="Статус заказа" description="Статус оплаты заказа" path="/order-status" noindex />
      <Header />

      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">

          {state === 'checking' && (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="Loader2" size={32} className="text-gray-400 animate-spin" />
              </div>
              <h1 className="font-heading font-bold text-2xl text-primary mb-2">Проверяем оплату...</h1>
              <p className="text-gray-500 text-sm mb-6">Это займёт несколько секунд, не закрывайте страницу.</p>
            </>
          )}

          {state === 'paid' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="CheckCircle" size={32} className="text-green-500" />
              </div>
              <h1 className="font-heading font-bold text-2xl text-primary mb-2">Спасибо за оплату!</h1>
              <p className="text-gray-500 text-sm mb-6">
                Платёж прошёл успешно, заявка подтверждена. Подтверждение придёт на указанную почту.
              </p>
              {order?.order_number && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-left">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Номер заказа</p>
                  <p className="font-semibold text-primary">{order.order_number}</p>
                </div>
              )}
            </>
          )}

          {state === 'pending' && (
            <>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="Clock" size={32} className="text-orange-500" />
              </div>
              <h1 className="font-heading font-bold text-2xl text-primary mb-2">Платёж обрабатывается</h1>
              <p className="text-gray-500 text-sm mb-6">
                Мы ещё не получили подтверждение от банка. Обычно это занимает несколько минут — статус заявки обновится автоматически, обновите эту страницу чуть позже.
              </p>
              {order?.order_number && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-left">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Номер заказа</p>
                  <p className="font-semibold text-primary">{order.order_number}</p>
                </div>
              )}
            </>
          )}

          {state === 'canceled' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="XCircle" size={32} className="text-red-500" />
              </div>
              <h1 className="font-heading font-bold text-2xl text-primary mb-2">Оплата не прошла</h1>
              <p className="text-gray-500 text-sm mb-6">
                Платёж был отклонён или отменён. Заявка на участие не сохранена — попробуйте подать заявку и оплатить ещё раз.
              </p>
              {order?.order_number && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-left">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Номер заказа</p>
                  <p className="font-semibold text-primary">{order.order_number}</p>
                </div>
              )}
              <Link to="/turnir">
                <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mb-3">
                  <Icon name="RotateCcw" size={16} className="mr-2" /> Попробовать снова
                </Button>
              </Link>
            </>
          )}

          {state === 'not_found' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="AlertTriangle" size={32} className="text-red-500" />
              </div>
              <h1 className="font-heading font-bold text-2xl text-primary mb-2">Что-то пошло не так</h1>
              <p className="text-gray-500 text-sm mb-6">
                Не удалось найти информацию о заказе. Если деньги были списаны, напишите нам — мы всё проверим.
              </p>
              <Link to="/turnir">
                <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mb-3">
                  <Icon name="RotateCcw" size={16} className="mr-2" /> Вернуться к турнирам
                </Button>
              </Link>
            </>
          )}

          <Link to="/">
            <Button className="w-full" variant="outline">
              <Icon name="Home" size={16} className="mr-2" /> На главную
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
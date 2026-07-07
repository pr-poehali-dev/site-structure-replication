import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';

interface PendingOrder {
  order_number: string;
  order_id: number;
  payment_id: string;
  created_at: string;
}

export default function OrderStatus() {
  const [order, setOrder] = useState<PendingOrder | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('yookassa_pending_order');
    if (raw) {
      try {
        setOrder(JSON.parse(raw));
      } catch {
        setOrder(null);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="CheckCircle" size={32} className="text-green-500" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-primary mb-2">Спасибо за оплату!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Мы получили ваш платёж и обрабатываем заказ. Подтверждение придёт на указанную почту.
          </p>

          {order?.order_number && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 text-left">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Номер заказа</p>
              <p className="font-semibold text-primary">{order.order_number}</p>
            </div>
          )}

          <Link to="/">
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              <Icon name="Home" size={16} className="mr-2" /> На главную
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

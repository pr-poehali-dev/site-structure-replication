import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import Icon from '@/components/ui/icon';

const PUBLIC_PUSH_URL = 'https://functions.poehali.dev/0283b8d1-cf35-4020-abe4-ff1a3aa17308';
const PROMPT_DISMISSED_KEY = 'chess_push_prompt_dismissed';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PublicPushSubscribeProps {
  hideTrigger?: boolean;
}

export default function PublicPushSubscribe({ hideTrigger = false }: PublicPushSubscribeProps) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [showSidePrompt, setShowSidePrompt] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !window.isSecureContext) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      if (!sub && Notification.permission !== 'denied' && !sessionStorage.getItem(PROMPT_DISMISSED_KEY)) {
        setTimeout(() => setShowSidePrompt(true), 1500);
      }
    }).catch(() => setSupported(false));
  }, []);

  function dismissSidePrompt() {
    setShowSidePrompt(false);
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
  }

  async function doSubscribe() {
    if (Notification.permission === 'denied') {
      toast.error('Уведомления заблокированы в настройках браузера. Разреши их вручную: значок замка рядом с адресом сайта → Уведомления → Разрешить');
      return;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setLoading(false);
        return;
      }

      const keyRes = await fetch(PUBLIC_PUSH_URL);
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        toast.error('Не удалось подключить уведомления. Попробуйте позже.');
        setLoading(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      await fetch(PUBLIC_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'subscribe', subscription: sub.toJSON() }),
      });

      setSubscribed(true);
      setShowSidePrompt(false);
      toast.success('Вы подписались на уведомления о новых турнирах');
    } catch {
      toast.error('Не удалось включить уведомления');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(PUBLIC_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _action: 'unsubscribe', subscription: sub.toJSON() }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Уведомления отключены');
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  if (subscribed) {
    if (hideTrigger) return null;
    return (
      <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={loading}
        className="border-white/30 text-white hover:bg-white/10 bg-transparent">
        <Icon name="BellOff" size={16} className="mr-1.5" /> Отключить уведомления
      </Button>
    );
  }

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" size="sm" onClick={() => setShowExplain(true)} disabled={loading}
          className="border-white/30 text-white hover:bg-white/10 bg-transparent">
          <Icon name="Bell" size={16} className="mr-1.5" /> Уведомлять о новых турнирах
        </Button>
      )}
      <AlertDialog open={showExplain} onOpenChange={setShowExplain}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="Bell" size={20} className="text-primary" /> Уведомления о турнирах
            </AlertDialogTitle>
            <AlertDialogDescription>
              Мы будем присылать уведомление, когда откроется регистрация на новый турнир.
              В следующем окне браузер спросит разрешение — нажмите «Разрешить», чтобы не пропустить новости.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Не сейчас</AlertDialogCancel>
            <AlertDialogAction onClick={doSubscribe}>Разрешить уведомления</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showSidePrompt && (
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-right-8 fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 relative">
            <button onClick={dismissSidePrompt} aria-label="Закрыть"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <Icon name="X" size={18} />
            </button>
            <div className="flex items-start gap-3 pr-5">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="Bell" size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Не пропустите новый турнир!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Включите уведомления — и мы сообщим, когда откроется регистрация.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={dismissSidePrompt}>
                Не сейчас
              </Button>
              <Button size="sm" className="flex-1" onClick={() => { setShowSidePrompt(false); setShowExplain(true); }}>
                Включить
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
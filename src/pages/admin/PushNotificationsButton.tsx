import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { PUSH_SUBSCRIBE_URL } from './adminTypes';

interface PushNotificationsButtonProps {
  password: string;
}

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

export default function PushNotificationsButton({ password }: PushNotificationsButtonProps) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    }).catch(() => setSupported(false));
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setLoading(false); return; }

      const keyRes = await fetch(PUSH_SUBSCRIBE_URL, { headers: { 'X-Admin-Password': password } });
      const keyData = await keyRes.json();
      if (!keyData.publicKey) { setLoading(false); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      await fetch(PUSH_SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ _action: 'subscribe', subscription: sub.toJSON() }),
      });

      setSubscribed(true);
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
        await fetch(PUSH_SUBSCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
          body: JSON.stringify({ _action: 'unsubscribe', subscription: sub.toJSON() }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return subscribed ? (
    <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
      onClick={handleUnsubscribe} disabled={loading}>
      <Icon name="BellOff" size={16} className="mr-1" /> Отключить уведомления
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
      onClick={handleSubscribe} disabled={loading}>
      <Icon name="Bell" size={16} className="mr-1" /> Включить уведомления
    </Button>
  );
}

import { useEffect, useRef } from 'react';
import Pusher, { Channel } from 'pusher-js';

let pusherInstance: Pusher | null = null;

function getPusher(key: string, cluster: string): Pusher | null {
  if (!key) return null;
  if (!pusherInstance) {
    pusherInstance = new Pusher(key, { cluster });
  }
  return pusherInstance;
}

/**
 * Подписывается на канал Pusher и вызывает onEvent для каждого события.
 * pusherKey/pusherCluster приходят с бэкенда (публичные, не секретные значения).
 */
export function usePusherChannel(
  channelName: string | null,
  pusherKey: string | null,
  pusherCluster: string | null,
  onEvent: (event: string, data: unknown) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!channelName || !pusherKey) return;
    const pusher = getPusher(pusherKey, pusherCluster || 'eu');
    if (!pusher) return;

    const channel: Channel = pusher.subscribe(channelName);
    const handler = (event: string) => (data: unknown) => onEventRef.current(event, data);

    const events = ['update', 'chat', 'round-started', 'round-completed', 'game-finished', 'finished'];
    const bound = events.map(ev => {
      const h = handler(ev);
      channel.bind(ev, h);
      return { ev, h };
    });

    return () => {
      bound.forEach(({ ev, h }) => channel.unbind(ev, h));
      pusher.unsubscribe(channelName);
    };
  }, [channelName, pusherKey, pusherCluster]);
}

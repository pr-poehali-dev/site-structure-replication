import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { calcAge, initials, fileToBase64 } from './utils';
import func2url from '../../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];

export type CabinetTab = 'tournaments' | 'profile' | 'balance' | 'games' | 'orders';

const MENU: { key: CabinetTab; label: string; icon: string; soon?: boolean }[] = [
  { key: 'tournaments', label: 'Мои турниры', icon: 'Swords' },
  { key: 'profile', label: 'Профиль', icon: 'UserCog' },
  { key: 'balance', label: 'Баланс', icon: 'Wallet' },
  { key: 'games', label: 'История партий', icon: 'History', soon: true },
  { key: 'orders', label: 'Заказы атрибутики', icon: 'Package', soon: true },
];

interface Props {
  tab: CabinetTab;
  onChange: (tab: CabinetTab) => void;
}

export default function CabinetSidebar({ tab, onChange }: Props) {
  const { user, token, uploadAvatar } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(BALANCE_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setBalance(data.balance || 0))
      .catch(() => {});
  }, [token, tab]);

  if (!user) return null;
  const age = calcAge(user.birth_date);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { base64, contentType } = await fileToBase64(file);
      await uploadAvatar(base64, contentType);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-20">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center gap-3">
        <div className="relative shrink-0">
          <Avatar className="w-16 h-16 border-2 border-secondary/30">
            <AvatarImage src={user.avatar_url || undefined} alt={user.first_name} />
            <AvatarFallback className="bg-gradient-to-br from-secondary/70 to-secondary text-white font-heading font-bold text-lg">
              {initials(user.last_name, user.first_name)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow hover:bg-secondary/90 transition-colors"
            title="Загрузить фото"
          >
            <Icon name={uploadingAvatar ? 'Loader2' : 'Camera'} size={12} className={uploadingAvatar ? 'animate-spin' : ''} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div>
          <p className="font-heading font-bold text-base text-primary leading-tight">{user.last_name} {user.first_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          {age !== null && <p className="text-xs text-gray-400">{age} лет</p>}
        </div>

        <div className="w-full flex flex-col gap-2">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left">Рейтинг МШ (Мир шахмат)</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
                    <Icon name="Info" size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                  Рейтинг МШ рассчитывается по итогам турниров, которые проводит «Мир шахмат». Стартовое значение равно вашему рейтингу ФШР на момент регистрации на платформе, а дальше оно растёт вместе с вашими результатами у нас.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-muted/50 rounded-lg px-2 py-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Блиц</p>
                <p className="font-heading font-bold text-sm text-primary">{user.rating_blitz ?? '—'}</p>
              </div>
              <div className="flex-1 bg-muted/50 rounded-lg px-2 py-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Рапид</p>
                <p className="font-heading font-bold text-sm text-primary">{user.rating_rapid ?? '—'}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-left">Рейтинг ФШР</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-secondary/10 rounded-lg px-2 py-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Блиц</p>
                <p className="font-heading font-bold text-sm text-primary">{user.fsr_rating_blitz ?? '—'}</p>
              </div>
              <div className="flex-1 bg-secondary/10 rounded-lg px-2 py-2 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Рапид</p>
                <p className="font-heading font-bold text-sm text-primary">{user.fsr_rating_rapid ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex flex-col gap-0.5">
        {MENU.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              tab === item.key ? 'bg-secondary/15 text-primary' : 'text-gray-500 hover:bg-muted/60 hover:text-gray-700'
            }`}
          >
            <Icon name={item.icon} size={17} className={tab === item.key ? 'text-secondary' : 'text-gray-400'} />
            <span className="flex-1">
              {item.label}
              {item.key === 'balance' && balance !== null && ` (${balance.toLocaleString('ru')} ₽)`}
            </span>
            {item.soon && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Скоро</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export type TournamentType = 'warmup' | 'training' | 'qualifying';

export const TYPE_META: Record<TournamentType, { label: string; icon: string; badge: string; bar: string; hint: string }> = {
  warmup: {
    label: 'Разминочный турнир',
    icon: 'Flame',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    bar: 'bg-yellow-400',
    hint: 'Полностью открытый турнир для разминки: без деления по рейтингу, без дипломов и официальных результатов. Приходите и играйте для удовольствия.',
  },
  training: {
    label: 'Тренировочный турнир',
    icon: 'Target',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    bar: 'bg-emerald-500',
    hint: 'Игра с делением по рейтингу, чтобы соперники были по силам. Участникам доступен диплом. Подходит для практики и накопления опыта.',
  },
  qualifying: {
    label: 'Квалификационный турнир',
    icon: 'Trophy',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    bar: 'bg-orange-500',
    hint: 'Главный формат: деление по возрастным группам и рейтингу, официальные результаты и протокол, дипломы, награды и влияние на рейтинг.',
  },
};

export const TYPE_POINTS: Record<TournamentType, number> = { warmup: 1, training: 2, qualifying: 3 };

export function getTypePoints(type?: string) {
  return TYPE_POINTS[(type as TournamentType)] ?? 3;
}

export function ActivityPointsBadge({ type }: { type?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-violet-100 text-violet-800 border-violet-300">
      <Icon name="Flame" size={11} />
      + {getTypePoints(type)} очк{getTypePoints(type) === 1 ? 'о' : 'а'} активности
    </span>
  );
}

export function getTypeMeta(type?: string) {
  return TYPE_META[(type as TournamentType)] || TYPE_META.qualifying;
}

export default function TournamentTypeBadge({ type }: { type?: string }) {
  const m = getTypeMeta(type);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border cursor-help ${m.badge}`}>
          <Icon name={m.icon} size={13} />
          {m.label}
          <Icon name="Info" size={12} className="opacity-60" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm leading-snug">{m.hint}</TooltipContent>
    </Tooltip>
  );
}

export function RatingTypeBadge({ type }: { type?: string }) {
  const blitz = type === 'blitz';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${blitz ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
      <Icon name={blitz ? 'Zap' : 'Clock'} size={13} />
      {blitz ? 'Блиц' : 'Рапид'}
    </span>
  );
}

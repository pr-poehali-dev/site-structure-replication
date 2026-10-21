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

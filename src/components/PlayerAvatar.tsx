import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { fioInitials } from '@/lib/fio';

interface PlayerAvatarProps {
  fio: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

/** Маленький круглый аватар игрока с фолбэком на инициалы — используется рядом с именем
 * на странице партии и в турнирном зале. */
export default function PlayerAvatar({ fio, avatarUrl, size = 24, className }: PlayerAvatarProps) {
  return (
    <Avatar className={`shrink-0 border border-gray-200 ${className || ''}`} style={{ width: size, height: size }}>
      <AvatarImage src={avatarUrl || undefined} alt={fio || ''} />
      <AvatarFallback
        className="bg-gradient-to-br from-secondary/70 to-secondary text-white font-heading font-bold"
        style={{ fontSize: Math.max(9, size * 0.4) }}
      >
        {fioInitials(fio)}
      </AvatarFallback>
    </Avatar>
  );
}

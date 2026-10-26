import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';

export default function ImpersonateBanner() {
  const { user, impersonating, stopImpersonation } = useAuth();
  if (!impersonating || !user) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full bg-secondary text-secondary-foreground shadow-lg px-4 py-2 text-sm font-semibold">
      <Icon name="UserCog" size={16} />
      <span>Вы вошли как {user.last_name} {user.first_name}</span>
      <button type="button" onClick={stopImpersonation} className="rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs">
        Вернуться в свой аккаунт
      </button>
    </div>
  );
}

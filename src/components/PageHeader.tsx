import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import type { ReactNode } from 'react';

interface Props {
  icon: string;
  title: ReactNode;
  subtitle?: string;
  crumb: string;
  actions?: ReactNode;
}

export default function PageHeader({ icon, title, subtitle, crumb, actions }: Props) {
  return (
    <section className="bg-gradient-to-r from-[#14224F] via-[#1B2F6B] to-[#14224F] text-white">
      <div className="container px-4 py-5 md:py-6 max-w-6xl mx-auto">
        <nav className="flex items-center gap-1.5 text-xs text-white/60 mb-3">
          <Link to="/" className="hover:text-white flex items-center gap-1"><Icon name="Home" size={12} /> Главная</Link>
          <Icon name="ChevronRight" size={12} />
          <span className="text-white/90">{crumb}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="grid place-items-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/10 border border-white/20 shrink-0">
              <Icon name={icon} size={26} className="text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-2xl md:text-3xl uppercase leading-tight">{title}</h1>
              {subtitle && <p className="text-sm text-white/75 mt-1 max-w-2xl">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      </div>
    </section>
  );
}

import Icon from '@/components/ui/icon';

export default function ComingSoon({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 px-6 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
        <Icon name={icon} size={26} className="text-secondary" />
      </div>
      <h3 className="font-heading font-bold text-lg text-primary">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted text-gray-400 mt-1">Раздел в разработке</span>
    </div>
  );
}

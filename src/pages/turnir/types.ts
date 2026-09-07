export interface Tournament {
  id: number;
  title: string;
  description: string;
  date: string | null;
  location: string;
  age_category: string;
  price: number | null;
  time_control: string;
  time_msk: string;
  status: string;
  diploma_sample_url: string | null;
  regulation_url: string | null;
  announcement_url: string | null;
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

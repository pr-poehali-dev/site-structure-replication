export interface Tournament {
  id: number; title: string; description: string; date: string | null;
  location: string; age_category: string; price: number | null; fsr_id: string; created_at: string;
  status: string;
  diploma_sample_url: string | null; regulation_url: string | null; announcement_url: string | null;
}

export interface Application {
  id: number; tournament_id: number | null; tournament_title: string;
  fio: string; age: string; fsr_id: string; coach: string; country_city: string;
  school: string; email: string; phone: string; status: string; notes: string; created_at: string;
}

export interface AwardKit {
  id: number; title: string; description: string; composition: string[];
  price: number | null; icon: string; photo_url: string | null;
  sort_order: number; is_active: boolean; created_at: string;
}

export interface AwardOrder {
  id: number; customer_name: string; customer_phone: string; customer_email: string | null;
  items: { kit_id: string; kit_title: string; tournament_id: number | null; tournament_title: string; price: number | null }[];
  total_price: number | null; status: string; notes: string | null; created_at: string;
}

export interface TournamentResult {
  id: number; number: number | null; date: string | null; title: string;
  fsr_rating: string | null; protocol_url: string | null; regulation_url: string | null;
}

export const TOURNAMENTS_URL = 'https://functions.poehali.dev/9a8eb98d-1a35-4b77-9828-603a76a903ed';
export const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';
export const AWARD_CATALOG_ADMIN_URL = 'https://functions.poehali.dev/6d39bfe8-ce2f-4ed5-821a-a3784713fcdd';
export const AWARD_ORDERS_URL = 'https://functions.poehali.dev/572ab5d3-bfa9-4a78-8d49-a35187da0bb7';
export const AWARD_TOURNAMENTS_URL = 'https://functions.poehali.dev/fd3814c3-2340-45ce-81f9-80e07768efe2';
export const RESULTS_URL = 'https://functions.poehali.dev/63f1c6fa-4f4f-4834-94be-73b844b9d51a';

export const EMPTY_T_FORM = { title: '', description: '', date: '', location: '', age_category: '', price: '', fsr_id: '', diploma_sample_url: '', regulation_url: '', announcement_url: '' };
export const EMPTY_KIT_FORM = { title: '', description: '', composition: '', price: '', icon: 'award', photo_url: '', sort_order: '0', is_active: true };
export const STATUS_LABELS: Record<string, string> = { new: 'Новая', pending_payment: 'Ждёт оплаты', confirmed: 'Подтверждена', paid: 'Оплачена', cancelled: 'Отменена' };
export const STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', pending_payment: 'bg-orange-100 text-orange-700', confirmed: 'bg-green-100 text-green-700', paid: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };
export const ORDER_STATUS_LABELS: Record<string, string> = { new: 'Новый', processing: 'В работе', done: 'Выполнен', cancelled: 'Отменён' };
export const ORDER_STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', processing: 'bg-yellow-100 text-yellow-700', done: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
export const ICON_OPTIONS = ['award', 'trophy', 'medal', 'star', 'gift', 'crown'];
export const EMPTY_TR_FORM = { number: '', date: '', title: '', fsr_rating: '', protocol_url: '', regulation_url: '' };

export type Section = 'tournaments' | 'applications' | 'awards' | 'award-orders' | 'results';
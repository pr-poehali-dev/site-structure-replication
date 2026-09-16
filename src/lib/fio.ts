/** Оставляет только фамилию и имя из полного ФИО, отбрасывая отчество. */
export function shortFio(fio: string | null | undefined): string {
  if (!fio) return '';
  const parts = fio.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

/** Инициалы (первые буквы фамилии и имени) из полного ФИО — для заглушки аватара. */
export function fioInitials(fio: string | null | undefined): string {
  if (!fio) return '?';
  const parts = fio.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
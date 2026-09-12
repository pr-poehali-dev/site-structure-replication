/** Оставляет только фамилию и имя из полного ФИО, отбрасывая отчество. */
export function shortFio(fio: string | null | undefined): string {
  if (!fio) return '';
  const parts = fio.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

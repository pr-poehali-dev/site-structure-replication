import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import * as XLSX from 'xlsx';
import {
  Tournament, Application, TOURNAMENTS_URL, EMPTY_T_FORM, STATUS_LABELS, STATUS_COLORS,
} from './adminTypes';
import NotifyTournamentButton from './NotifyTournamentButton';

interface TournamentsSectionProps {
  password: string;
  tournaments: Tournament[];
  apps: Application[];
  tLoading: boolean;
  tForm: typeof EMPTY_T_FORM;
  setTForm: Dispatch<SetStateAction<typeof EMPTY_T_FORM>>;
  tSaving: boolean;
  setTSaving: Dispatch<SetStateAction<boolean>>;
  tShowForm: boolean;
  setTShowForm: Dispatch<SetStateAction<boolean>>;
  tError: string;
  setTError: Dispatch<SetStateAction<string>>;
  tEditId: number | null;
  setTEditId: Dispatch<SetStateAction<number | null>>;
  fetchTournaments: () => Promise<void>;
}

export default function TournamentsSection({
  password, tournaments, apps, tLoading, tForm, setTForm, tSaving, setTSaving,
  tShowForm, setTShowForm, tError, setTError, tEditId, setTEditId, fetchTournaments,
}: TournamentsSectionProps) {
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const [uploadingRegulation, setUploadingRegulation] = useState(false);
  const [uploadingAnnouncement, setUploadingAnnouncement] = useState(false);
  const diplomaInputRef = useRef<HTMLInputElement>(null);
  const regulationInputRef = useRef<HTMLInputElement>(null);
  const announcementInputRef = useRef<HTMLInputElement>(null);

  async function uploadTournamentFile(file: File): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const b64 = (reader.result as string).split(',')[1];
          const res = await fetch(TOURNAMENTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
            body: JSON.stringify({ _action: 'upload_file', file_b64: b64, content_type: file.type, file_name: file.name }),
          });
          if (!res.ok) { reject(new Error('Ошибка загрузки файла')); return; }
          const data = await res.json();
          resolve(data.url || null);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }

  async function handleDiplomaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDiploma(true);
    try {
      const url = await uploadTournamentFile(file);
      if (url) setTForm({ ...tForm, diploma_sample_url: url });
    } catch {
      setTError('Не удалось загрузить файл образца диплома');
    }
    setUploadingDiploma(false);
  }

  async function handleRegulationFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRegulation(true);
    try {
      const url = await uploadTournamentFile(file);
      if (url) setTForm({ ...tForm, regulation_url: url });
    } catch {
      setTError('Не удалось загрузить файл положения');
    }
    setUploadingRegulation(false);
  }

  async function handleAnnouncementFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAnnouncement(true);
    try {
      const url = await uploadTournamentFile(file);
      if (url) setTForm({ ...tForm, announcement_url: url });
    } catch {
      setTError('Не удалось загрузить изображение анонса');
    }
    setUploadingAnnouncement(false);
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    setTSaving(true); setTError('');
    const isEdit = tEditId !== null;
    const res = await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        ...tForm,
        price: tForm.price ? parseFloat(tForm.price) : null,
        ...(isEdit ? { _action: 'update', id: tEditId } : {}),
      }),
    });
    if (res.ok) {
      setTForm(EMPTY_T_FORM); setTShowForm(false); setTEditId(null); fetchTournaments();
      if (diplomaInputRef.current) diplomaInputRef.current.value = '';
      if (regulationInputRef.current) regulationInputRef.current.value = '';
      if (announcementInputRef.current) announcementInputRef.current.value = '';
    }
    else setTError('Ошибка при сохранении');
    setTSaving(false);
  }

  function handleEditTournament(t: Tournament) {
    setTEditId(t.id);
    setTForm({
      title: t.title || '',
      description: t.description || '',
      date: t.date ? t.date.slice(0, 10) : '',
      location: t.location || '',
      age_category: t.age_category || '',
      price: t.price != null ? String(t.price) : '',
      time_control: t.time_control || '',
      time_msk: t.time_msk || '',
      diploma_sample_url: t.diploma_sample_url || '',
      regulation_url: t.regulation_url || '',
      announcement_url: t.announcement_url || '',
    });
    setTError('');
    setTShowForm(true);
  }

  function handleCancelTournamentForm() {
    setTShowForm(false);
    setTEditId(null);
    setTForm(EMPTY_T_FORM);
    setTError('');
    if (diplomaInputRef.current) diplomaInputRef.current.value = '';
    if (regulationInputRef.current) regulationInputRef.current.value = '';
    if (announcementInputRef.current) announcementInputRef.current.value = '';
  }

  async function handleDeleteTournament(id: number) {
    if (!confirm('Удалить турнир?')) return;
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchTournaments();
  }

  function handleExportApps(t: Tournament) {
    const tApps = apps.filter(a => a.tournament_id === t.id);
    if (tApps.length === 0) return;
    const rows = tApps.map((a, i) => ({
      '№': i + 1,
      'ФИО участника': a.fio,
      'Возраст': a.age,
      'ID ФШР': a.fsr_id,
      'ФИО тренера': a.coach,
      'Страна / Город': a.country_city,
      'Учебное заведение': a.school,
      'Email': a.email,
      'Телефон': a.phone,
      'Статус': STATUS_LABELS[a.status] || a.status,
      'Заметки': a.notes,
      'Дата подачи': new Date(a.created_at).toLocaleString('ru-RU'),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 4 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 28 },
      { wch: 20 }, { wch: 24 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Заявки');
    const safeTitle = t.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
    XLSX.writeFile(workbook, `Заявки — ${safeTitle}.xlsx`);
  }

  async function handleToggleStatus(t: Tournament) {
    const newStatus = t.status === 'open' ? 'closed' : 'open';
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_status', id: t.id, status: newStatus }),
    });
    fetchTournaments();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Swords" size={22} /> Турниры
        </h2>
        <Button onClick={() => (tShowForm ? handleCancelTournamentForm() : setTShowForm(true))}>
          <Icon name={tShowForm ? 'X' : 'Plus'} size={16} className="mr-1" />
          {tShowForm ? 'Отмена' : 'Добавить турнир'}
        </Button>
      </div>

      {tShowForm && (
        <form onSubmit={handleCreateTournament} className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <h3 className="md:col-span-2 font-bold text-lg text-primary -mb-2">{tEditId !== null ? 'Редактирование турнира' : 'Новый турнир'}</h3>
          <div className="md:col-span-2"><Label>Название *</Label><Input className="mt-1" value={tForm.title} onChange={e => setTForm({ ...tForm, title: e.target.value })} required /></div>
          <div className="md:col-span-2"><Label>Описание</Label><Textarea className="mt-1" rows={3} value={tForm.description} onChange={e => setTForm({ ...tForm, description: e.target.value })} /></div>
          <div><Label>Дата</Label><Input type="date" className="mt-1" value={tForm.date} onChange={e => setTForm({ ...tForm, date: e.target.value })} /></div>
          <div><Label>Место проведения</Label><Input className="mt-1" value={tForm.location} onChange={e => setTForm({ ...tForm, location: e.target.value })} /></div>
          <div><Label>Возрастная категория</Label><Input className="mt-1" value={tForm.age_category} onChange={e => setTForm({ ...tForm, age_category: e.target.value })} /></div>
          <div><Label>Стоимость участия (₽)</Label><Input type="number" className="mt-1" value={tForm.price} onChange={e => setTForm({ ...tForm, price: e.target.value })} /></div>
          <div><Label>Контроль времени</Label><Input className="mt-1" placeholder="10+0" value={tForm.time_control} onChange={e => setTForm({ ...tForm, time_control: e.target.value })} /></div>
          <div><Label>Время МСК</Label><Input className="mt-1" placeholder="19:00" value={tForm.time_msk} onChange={e => setTForm({ ...tForm, time_msk: e.target.value })} /></div>

          <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Документы турнира</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Образец диплома (изображение)</Label>
                <input ref={diplomaInputRef} type="file" accept="image/*" onChange={handleDiplomaFileChange}
                  className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 cursor-pointer" />
                {uploadingDiploma && <p className="text-xs text-secondary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
                {tForm.diploma_sample_url && !uploadingDiploma && (
                  <img src={tForm.diploma_sample_url} alt="Образец диплома" className="mt-2 w-full max-h-40 object-contain rounded-lg border border-gray-100" />
                )}
              </div>
              <div>
                <Label>Положение (PDF-файл)</Label>
                <input ref={regulationInputRef} type="file" accept="application/pdf,.pdf" onChange={handleRegulationFileChange}
                  className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                {uploadingRegulation && <p className="text-xs text-primary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
                {tForm.regulation_url && !uploadingRegulation && (
                  <a href={tForm.regulation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                    <Icon name="FileCheck" size={13} /> Файл загружен
                  </a>
                )}
              </div>
              <div className="md:col-span-2">
                <Label>Официальный анонс (изображение)</Label>
                <input ref={announcementInputRef} type="file" accept="image/*" onChange={handleAnnouncementFileChange}
                  className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" />
                {uploadingAnnouncement && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
                {tForm.announcement_url && !uploadingAnnouncement && (
                  <img src={tForm.announcement_url} alt="Анонс" className="mt-2 w-full max-h-40 object-contain rounded-lg border border-gray-100" />
                )}
              </div>
            </div>
          </div>

          {tError && <p className="md:col-span-2 text-red-500 text-sm">{tError}</p>}
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCancelTournamentForm}>Отмена</Button>
            <Button type="submit" disabled={tSaving}>{tSaving ? 'Сохранение...' : tEditId !== null ? 'Сохранить изменения' : 'Создать турнир'}</Button>
          </div>
        </form>
      )}

      {tLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
        : tournaments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Swords" size={40} className="mx-auto mb-3 opacity-30" />
            <p>Турниров пока нет</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tournaments.map(t => {
              const tApps = apps.filter(a => a.tournament_id === t.id);
              return (
                <div key={t.id} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-lg text-primary">{t.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.status === 'open' ? 'Открыт' : 'Закрыт'}
                        </span>
                        {tApps.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {tApps.length} заявок
                          </span>
                        )}
                      </div>
                      {t.date && <p className="text-sm text-gray-500 mb-1">{new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                      {t.location && <p className="text-sm text-gray-500">{t.location}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleEditTournament(t)}>
                        <Icon name="Pencil" size={14} className="mr-1" /> Редактировать
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleStatus(t)}>
                        <Icon name={t.status === 'open' ? 'PauseCircle' : 'PlayCircle'} size={14} className="mr-1" />
                        {t.status === 'open' ? 'Закрыть приём' : 'Открыть приём'}
                      </Button>
                      <NotifyTournamentButton password={password} tournament={t} />
                      <Button variant="outline" size="sm" disabled={tApps.length === 0} onClick={() => handleExportApps(t)}>
                        <Icon name="FileSpreadsheet" size={14} className="mr-1" /> Экспорт в Excel
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteTournament(t.id)}>
                        <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                      </Button>
                    </div>
                  </div>
                  {tApps.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Участники</p>
                      <div className="flex flex-col gap-1">
                        {tApps.map((a, i) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 w-5 shrink-0">{i + 1}.</span>
                            <span className="font-medium text-gray-800">{a.fio}</span>
                            {a.age && <span className="text-gray-400">· {a.age}</span>}
                            {a.country_city && <span className="text-gray-400">· {a.country_city}</span>}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[a.status] || a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}
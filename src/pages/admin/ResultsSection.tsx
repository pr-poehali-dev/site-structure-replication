import { Dispatch, SetStateAction, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { TournamentResult, RESULTS_URL, EMPTY_TR_FORM } from './adminTypes';

interface ResultsSectionProps {
  password: string;
  trResults: TournamentResult[];
  trLoading: boolean;
  trForm: typeof EMPTY_TR_FORM;
  setTrForm: Dispatch<SetStateAction<typeof EMPTY_TR_FORM>>;
  trShowForm: boolean;
  setTrShowForm: Dispatch<SetStateAction<boolean>>;
  trSaving: boolean;
  setTrSaving: Dispatch<SetStateAction<boolean>>;
  trError: string;
  setTrError: Dispatch<SetStateAction<string>>;
  trEdit: TournamentResult | null;
  setTrEdit: Dispatch<SetStateAction<TournamentResult | null>>;
  trUploading: string | null;
  setTrUploading: Dispatch<SetStateAction<string | null>>;
  trProtocolRef: RefObject<HTMLInputElement>;
  trRegulationRef: RefObject<HTMLInputElement>;
  trEditProtocolRef: RefObject<HTMLInputElement>;
  trEditRegulationRef: RefObject<HTMLInputElement>;
  fetchTrResults: () => Promise<void>;
}

export default function ResultsSection({
  password, trResults, trLoading, trForm, setTrForm, trShowForm, setTrShowForm,
  trSaving, setTrSaving, trError, setTrError, trEdit, setTrEdit, trUploading, setTrUploading,
  trProtocolRef, trRegulationRef, trEditProtocolRef, trEditRegulationRef, fetchTrResults,
}: ResultsSectionProps) {
  async function uploadResultFile(file: File, label: string): Promise<string | null> {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`Файл "${file.name}" слишком большой (максимум 8 МБ)`);
    }
    setTrUploading(label);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const b64 = (reader.result as string).split(',')[1];
          const res = await fetch(`${RESULTS_URL}?section=upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
            body: JSON.stringify({ file_b64: b64, content_type: file.type, file_name: file.name }),
          });
          setTrUploading(null);
          if (!res.ok) {
            reject(new Error(`Ошибка загрузки файла: ${file.name} (${res.status})`));
            return;
          }
          const data = await res.json();
          resolve(data.url || null);
        } catch (err) {
          setTrUploading(null);
          reject(err);
        }
      };
      reader.onerror = () => { setTrUploading(null); reject(new Error('Не удалось прочитать файл')); };
      reader.readAsDataURL(file);
    });
  }

  async function handleCreateTrResult(e: React.FormEvent) {
    e.preventDefault();
    setTrSaving(true); setTrError('');
    try {
      let protocolUrl = trForm.protocol_url;
      let regulationUrl = trForm.regulation_url;
      const protocolFile = trProtocolRef.current?.files?.[0];
      const regulationFile = trRegulationRef.current?.files?.[0];
      if (protocolFile) protocolUrl = (await uploadResultFile(protocolFile, 'protocol')) || protocolUrl;
      if (regulationFile) regulationUrl = (await uploadResultFile(regulationFile, 'regulation')) || regulationUrl;
      const res = await fetch(RESULTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ section: 'tournament', ...trForm, protocol_url: protocolUrl, regulation_url: regulationUrl, number: trForm.number ? parseInt(trForm.number) : null, date: trForm.date || null }),
      });
      if (res.ok) {
        setTrForm(EMPTY_TR_FORM);
        setTrShowForm(false);
        if (trProtocolRef.current) trProtocolRef.current.value = '';
        if (trRegulationRef.current) trRegulationRef.current.value = '';
        fetchTrResults();
      } else setTrError('Ошибка при сохранении');
    } catch (err) {
      setTrError(err instanceof Error ? err.message : 'Ошибка при загрузке файла');
    }
    setTrSaving(false);
  }

  async function handleUpdateTrResult(e: React.FormEvent) {
    e.preventDefault();
    if (!trEdit) return;
    setTrSaving(true); setTrError('');
    try {
      let protocolUrl = trEdit.protocol_url;
      let regulationUrl = trEdit.regulation_url;
      const protocolFile = trEditProtocolRef.current?.files?.[0];
      const regulationFile = trEditRegulationRef.current?.files?.[0];
      if (protocolFile) protocolUrl = await uploadResultFile(protocolFile, 'protocol');
      if (regulationFile) regulationUrl = await uploadResultFile(regulationFile, 'regulation');
      await fetch(RESULTS_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ section: 'tournament', ...trEdit, protocol_url: protocolUrl, regulation_url: regulationUrl }),
      });
      if (trEditProtocolRef.current) trEditProtocolRef.current.value = '';
      if (trEditRegulationRef.current) trEditRegulationRef.current.value = '';
      setTrEdit(null); fetchTrResults();
    } catch (err) {
      setTrError(err instanceof Error ? err.message : 'Ошибка при загрузке файла');
    }
    setTrSaving(false);
  }

  async function handleDeleteTrResult(id: number) {
    if (!confirm('Удалить запись?')) return;
    await fetch(`${RESULTS_URL}?section=tournament&id=${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': password },
    });
    fetchTrResults();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="ListChecks" size={22} /> Результаты турниров
        </h2>
        <Button onClick={() => { setTrShowForm(f => !f); setTrError(''); }} className="bg-primary text-white">
          <Icon name={trShowForm ? 'X' : 'Plus'} size={16} className="mr-2" />
          {trShowForm ? 'Закрыть' : 'Добавить запись'}
        </Button>
      </div>

      {trShowForm && (
        <form onSubmit={handleCreateTrResult} className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 flex flex-col gap-4">
          <h3 className="font-semibold text-gray-700">Новая запись</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>№</Label><Input type="number" className="mt-1" placeholder="1" value={trForm.number} onChange={e => setTrForm({ ...trForm, number: e.target.value })} /></div>
            <div><Label>Дата</Label><Input type="date" className="mt-1" value={trForm.date} onChange={e => setTrForm({ ...trForm, date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Название турнира *</Label><Input required className="mt-1" placeholder="Открытый чемпионат..." value={trForm.title} onChange={e => setTrForm({ ...trForm, title: e.target.value })} /></div>
            <div><Label>Рейтинг ФШР</Label><Input className="mt-1" placeholder="Рейтинговый / Нерейтинговый" value={trForm.fsr_rating} onChange={e => setTrForm({ ...trForm, fsr_rating: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Протокол (файл)</Label>
              <input ref={trProtocolRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 cursor-pointer" />
              {trUploading === 'protocol' && <p className="text-xs text-secondary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
            </div>
            <div>
              <Label>Положение (файл)</Label>
              <input ref={trRegulationRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
              {trUploading === 'regulation' && <p className="text-xs text-primary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
            </div>
          </div>
          {trError && <p className="text-red-500 text-sm">{trError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setTrShowForm(false)}>Отмена</Button>
            <Button type="submit" disabled={trSaving || !!trUploading}>{trSaving || trUploading ? 'Загрузка...' : 'Добавить'}</Button>
          </div>
        </form>
      )}

      {trLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8"><Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...</div>
      ) : trResults.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="FileSearch" size={48} className="mx-auto mb-3 opacity-20" />
          <p>Записей пока нет</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-12">№</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Дата</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Название</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Рейтинг ФШР</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Протокол</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Положение</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody>
              {trResults.map((tr, idx) => (
                <tr key={tr.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-3 text-gray-500">{tr.number ?? idx + 1}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {tr.date ? new Date(tr.date).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{tr.title}</td>
                  <td className="px-4 py-3 text-gray-500">{tr.fsr_rating || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {tr.protocol_url
                      ? <a href={tr.protocol_url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs font-medium">Открыть</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tr.regulation_url
                      ? <a href={tr.regulation_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs font-medium">Открыть</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setTrEdit(tr)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors" title="Редактировать">
                        <Icon name="Pencil" size={15} />
                      </button>
                      <button onClick={() => handleDeleteTrResult(tr.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Удалить">
                        <Icon name="Trash2" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модал редактирования результата турнира */}
      {trEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setTrEdit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование записи</h2>
              <button onClick={() => setTrEdit(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleUpdateTrResult} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>№</Label><Input type="number" className="mt-1" value={trEdit.number ?? ''} onChange={e => setTrEdit({ ...trEdit, number: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div><Label>Дата</Label><Input type="date" className="mt-1" value={trEdit.date || ''} onChange={e => setTrEdit({ ...trEdit, date: e.target.value || null })} /></div>
              </div>
              <div><Label>Название *</Label><Input required className="mt-1" value={trEdit.title} onChange={e => setTrEdit({ ...trEdit, title: e.target.value })} /></div>
              <div><Label>Рейтинг ФШР</Label><Input className="mt-1" value={trEdit.fsr_rating || ''} onChange={e => setTrEdit({ ...trEdit, fsr_rating: e.target.value || null })} /></div>
              <div>
                <Label>Протокол (файл)</Label>
                {trEdit.protocol_url && (
                  <a href={trEdit.protocol_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-secondary hover:underline mt-1 mb-1">
                    <Icon name="FileText" size={13} /> Текущий файл
                  </a>
                )}
                <input ref={trEditProtocolRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 cursor-pointer" />
                {trUploading === 'protocol' && <p className="text-xs text-secondary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
              </div>
              <div>
                <Label>Положение (файл)</Label>
                {trEdit.regulation_url && (
                  <a href={trEdit.regulation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1 mb-1">
                    <Icon name="BookOpen" size={13} /> Текущий файл
                  </a>
                )}
                <input ref={trEditRegulationRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                {trUploading === 'regulation' && <p className="text-xs text-primary mt-1 flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" /> Загрузка...</p>}
              </div>
              {trError && <p className="text-red-500 text-sm">{trError}</p>}
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setTrEdit(null)}>Отмена</Button>
                <Button type="submit" disabled={trSaving || !!trUploading}>{trSaving || trUploading ? 'Загрузка...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { FsrRatingFile, FSR_RATINGS_URL } from './adminTypes';

interface FsrRatingsSectionProps {
  password: string;
  files: FsrRatingFile[];
  loading: boolean;
  fetchFiles: () => Promise<void>;
}

const TYPE_LABELS: Record<'blitz' | 'rapid', string> = { blitz: 'Блиц', rapid: 'Рапид' };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FsrRatingsSection({ password, files, loading, fetchFiles }: FsrRatingsSectionProps) {
  const [uploading, setUploading] = useState<'blitz' | 'rapid' | null>(null);
  const blitzRef = useRef<HTMLInputElement>(null);
  const rapidRef = useRef<HTMLInputElement>(null);

  async function handleUpload(ratingType: 'blitz' | 'rapid', file: File | undefined) {
    if (!file) return;
    setUploading(ratingType);
    try {
      const file_b64 = await fileToBase64(file);
      const res = await fetch(FSR_RATINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ _action: 'upload', rating_type: ratingType, file_b64, file_name: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Не удалось загрузить файл');
        return;
      }
      toast.success(`Обновлено рейтингов: ${data.file.matched_count} из ${data.file.total_rows}`);
      fetchFiles();
    } catch {
      toast.error('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setUploading(null);
      if (blitzRef.current) blitzRef.current.value = '';
      if (rapidRef.current) rapidRef.current.value = '';
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="FileSpreadsheet" size={22} /> Файлы рейтинга ФШР
        </h2>
        <Button variant="outline" size="sm" onClick={() => fetchFiles()} disabled={loading}>
          <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Zap" size={18} className="text-secondary" />
            <h3 className="font-semibold text-primary">Рейтинг ФШР — Блиц</h3>
          </div>
          <p className="text-sm text-gray-400">Excel-файл: столбцы ID, ФИО, регион, рейтинг. Обновит рейтинг блиц у пользователей по совпадению ID ФШР.</p>
          <input ref={blitzRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleUpload('blitz', e.target.files?.[0])} />
          <Button onClick={() => blitzRef.current?.click()} disabled={uploading === 'blitz'}>
            {uploading === 'blitz' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Загружаем...</> : <><Icon name="Upload" size={16} className="mr-2" />Загрузить файл</>}
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Timer" size={18} className="text-secondary" />
            <h3 className="font-semibold text-primary">Рейтинг ФШР — Рапид</h3>
          </div>
          <p className="text-sm text-gray-400">Excel-файл: столбцы ID, ФИО, регион, рейтинг. Обновит рейтинг рапид у пользователей по совпадению ID ФШР.</p>
          <input ref={rapidRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleUpload('rapid', e.target.files?.[0])} />
          <Button onClick={() => rapidRef.current?.click()} disabled={uploading === 'rapid'}>
            {uploading === 'rapid' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Загружаем...</> : <><Icon name="Upload" size={16} className="mr-2" />Загрузить файл</>}
          </Button>
        </div>
      </div>

      <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
        <Icon name="History" size={18} /> История загрузок
      </h3>
      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow">
          <Icon name="FileSpreadsheet" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Файлы ещё не загружались</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {files.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm px-5 py-3.5 flex items-center gap-3 flex-wrap justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${f.rating_type === 'blitz' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {TYPE_LABELS[f.rating_type]}
                </span>
                <div className="min-w-0">
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline truncate block">{f.file_name}</a>
                  <p className="text-xs text-gray-400">{formatDateTime(f.uploaded_at)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 shrink-0">Обновлено: <span className="font-semibold text-primary">{f.matched_count}</span> из {f.total_rows}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

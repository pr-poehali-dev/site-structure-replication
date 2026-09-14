import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { FsrRatingFile, FsrOfficialSyncMap, FSR_RATINGS_URL } from './adminTypes';

interface FsrRatingsSectionProps {
  password: string;
  files: FsrRatingFile[];
  loading: boolean;
  fetchFiles: () => Promise<void>;
  lastSync: FsrOfficialSyncMap;
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

const CHUNK_SIZE = 250_000;
const DIRECT_UPLOAD_LIMIT = 300_000;

export default function FsrRatingsSection({ password, files, loading, fetchFiles, lastSync }: FsrRatingsSectionProps) {
  const [uploading, setUploading] = useState<'blitz' | 'rapid' | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<'blitz' | 'rapid' | null>(null);
  const blitzRef = useRef<HTMLInputElement>(null);
  const rapidRef = useRef<HTMLInputElement>(null);

  async function handleSyncOfficial(ratingType: 'blitz' | 'rapid') {
    setSyncing(ratingType);
    try {
      const res = await fetch(FSR_RATINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ _action: 'sync_official', rating_type: ratingType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Не удалось синхронизировать с сайтом ФШР');
        return;
      }
      toast.success(`${TYPE_LABELS[ratingType]}: обновлено ${data.result?.matched_count ?? 0} из ${data.result?.total_rows ?? 0} игроков`);
      fetchFiles();
    } catch {
      toast.error('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSyncing(null);
    }
  }

  async function handleUpload(ratingType: 'blitz' | 'rapid', file: File | undefined) {
    if (!file) return;
    setUploading(ratingType);
    setProgress(null);
    try {
      const file_b64 = await fileToBase64(file);

      if (file_b64.length <= DIRECT_UPLOAD_LIMIT) {
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
        return;
      }

      const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const totalChunks = Math.ceil(file_b64.length / CHUNK_SIZE);
      let lastData: { file?: { matched_count: number; total_rows: number } } | null = null;

      for (let i = 0; i < totalChunks; i++) {
        const chunk_b64 = file_b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const res = await fetch(FSR_RATINGS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
          body: JSON.stringify({
            _action: 'upload_chunk',
            session_id: sessionId,
            chunk_index: i,
            total_chunks: totalChunks,
            chunk_b64,
            rating_type: ratingType,
            file_name: file.name,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Не удалось загрузить файл');
          return;
        }
        lastData = data;
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      if (lastData?.file) {
        toast.success(`Обновлено рейтингов: ${lastData.file.matched_count} из ${lastData.file.total_rows}`);
        fetchFiles();
      }
    } catch {
      toast.error('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setUploading(null);
      setProgress(null);
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

      <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3 mb-6 border-2 border-secondary/20">
        <div className="flex items-center gap-2">
          <Icon name="Globe" size={18} className="text-secondary" />
          <h3 className="font-semibold text-primary">Синхронизация с официальным сайтом ФШР</h3>
        </div>
        <p className="text-sm text-gray-400">
          Скачивает актуальные рейтинги с ratings.ruchess.ru, обновляет всех зарегистрированных пользователей и пополняет базу для автозаполнения рейтинга при регистрации новых. Блиц и рапид синхронизируются отдельно.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSyncOfficial('blitz')} disabled={syncing === 'blitz'} className="w-fit">
              {syncing === 'blitz' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Синхронизируем...</> : <><Icon name="RefreshCw" size={16} className="mr-2" />Обновить блиц</>}
            </Button>
            {lastSync.blitz && (
              <p className="text-xs text-gray-400">
                {formatDateTime(lastSync.blitz.synced_at)} — обновлено {lastSync.blitz.matched_users} из {lastSync.blitz.total_players}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSyncOfficial('rapid')} disabled={syncing === 'rapid'} className="w-fit">
              {syncing === 'rapid' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Синхронизируем...</> : <><Icon name="RefreshCw" size={16} className="mr-2" />Обновить рапид</>}
            </Button>
            {lastSync.rapid && (
              <p className="text-xs text-gray-400">
                {formatDateTime(lastSync.rapid.synced_at)} — обновлено {lastSync.rapid.matched_users} из {lastSync.rapid.total_players}
              </p>
            )}
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-lg text-primary mb-3">Или загрузите файл вручную</h3>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Zap" size={18} className="text-secondary" />
            <h3 className="font-semibold text-primary">Рейтинг ФШР — Блиц</h3>
          </div>
          <p className="text-sm text-gray-400">CSV-файл: столбцы ID, ФИО, регион, рейтинг. Обновит рейтинг блиц у пользователей по совпадению ID ФШР.</p>
          <input ref={blitzRef} type="file" accept=".csv" className="hidden" onChange={e => handleUpload('blitz', e.target.files?.[0])} />
          <Button onClick={() => blitzRef.current?.click()} disabled={uploading === 'blitz'}>
            {uploading === 'blitz' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Загружаем{progress !== null ? ` ${progress}%` : '...'}</> : <><Icon name="Upload" size={16} className="mr-2" />Загрузить файл</>}
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Timer" size={18} className="text-secondary" />
            <h3 className="font-semibold text-primary">Рейтинг ФШР — Рапид</h3>
          </div>
          <p className="text-sm text-gray-400">CSV-файл: столбцы ID, ФИО, регион, рейтинг. Обновит рейтинг рапид у пользователей по совпадению ID ФШР.</p>
          <input ref={rapidRef} type="file" accept=".csv" className="hidden" onChange={e => handleUpload('rapid', e.target.files?.[0])} />
          <Button onClick={() => rapidRef.current?.click()} disabled={uploading === 'rapid'}>
            {uploading === 'rapid' ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Загружаем{progress !== null ? ` ${progress}%` : '...'}</> : <><Icon name="Upload" size={16} className="mr-2" />Загрузить файл</>}
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
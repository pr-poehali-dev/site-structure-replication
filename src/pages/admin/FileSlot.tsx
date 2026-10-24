import { useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { ELECTRONIC_RESULTS_URL, ResultFile } from '@/lib/electronicResults';

interface Props {
  tournamentId: number;
  password: string;
  username: string;
  kind: string;
  label: string;
  files: ResultFile[];
  onChanged: () => void;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const TARGET = 3 * 1024 * 1024;

async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= TARGET) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    let width = Math.min(img.naturalWidth, 2600);
    let quality = 0.92;
    let best: Blob | null = null;
    for (let i = 0; i < 8; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(img.naturalHeight * (width / img.naturalWidth));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      best = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
      if (best && best.size <= TARGET) break;
      if (quality > 0.75) quality -= 0.07;
      else width *= 0.85;
    }
    if (!best || best.size >= file.size) return file;
    return new File([best], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FileSlot({ tournamentId, password, username, kind, label, files, onChanged }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const file = files.find(f => f.username.toLowerCase() === username.toLowerCase() && f.kind === kind);

  async function post(body: object) {
    const res = await fetch(ELECTRONIC_RESULTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ tournament_id: tournamentId, username, kind, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка');
  }

  async function upload(orig: File) {
    if (orig.size > 20 * 1024 * 1024) { toast.error('Файл больше 20 МБ'); return; }
    setBusy(true);
    try {
      const f = await shrinkImage(orig);
      if (f.size > 4 * 1024 * 1024) { toast.error('Файл слишком тяжёлый, сохраните его как JPG или уменьшите'); setBusy(false); return; }
      await post({ _action: 'upload_file', content_type: f.type, file_name: f.name, file_b64: await toBase64(f) });
      toast.success('Файл загружен');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить');
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await post({ _action: 'delete_file' });
      onChanged();
    } catch {
      toast.error('Не удалось удалить');
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      {file ? (
        <>
          <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline flex items-center gap-1">
            <Icon name="FileCheck" size={13} /> {label}
          </a>
          <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="text-gray-500 hover:text-gray-800 underline">Заменить</button>
          <button type="button" disabled={busy} onClick={remove} className="text-red-500 hover:text-red-700"><Icon name="Trash2" size={13} /></button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="px-2.5 py-1 rounded-md border border-gray-300 hover:border-secondary text-gray-700 flex items-center gap-1">
          <Icon name={busy ? 'Loader2' : 'Upload'} size={12} className={busy ? 'animate-spin' : ''} /> {label}
        </button>
      )}
    </div>
  );
}
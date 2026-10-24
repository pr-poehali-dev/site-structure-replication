export interface DiplomaData {
  tournamentType: string;
  tournamentTitle: string;
  place: number | null;
  category: string | null;
  fio: string;
  institution: string | null;
  cityCountry: string | null;
  coach: string | null;
  ageCategory: string | null;
  ratingLimit: number | null;
  date: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  warmup: 'Разминочный турнир по шахматам',
  training: 'Тренировочный турнир по шахматам',
  qualifying: 'Квалификационный турнир по шахматам',
};

const ROMAN = ['', 'I', 'II', 'III'];
const CENTER_X = 820;
const FONT = '"Times New Roman", Times, serif';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить шаблон диплома'));
    img.src = url;
  });
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y} г.`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D, text: string, y: number, size: number,
  opts: { style?: string; color?: string; maxWidth?: number } = {},
) {
  if (!text) return;
  const maxWidth = opts.maxWidth ?? 900;
  let s = size;
  ctx.font = `${opts.style ?? 'bold'} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 1;
    ctx.font = `${opts.style ?? 'bold'} ${s}px ${FONT}`;
  }
  ctx.fillStyle = opts.color ?? '#222222';
  ctx.fillText(text, CENTER_X, y);
}

export async function renderDiploma(templateUrl: string, d: DiplomaData): Promise<Blob> {
  const img = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const k = canvas.width / 1414;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать диплом');
  ctx.drawImage(img, 0, 0);
  ctx.scale(k, k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  drawText(ctx, TYPE_LABELS[d.tournamentType] || 'Турнир по шахматам', 352, 42, { style: 'italic bold' });
  drawText(ctx, `«${d.tournamentTitle.replace(/^["«]|["»]$/g, '').trim()}»`, 405, 42, { style: 'italic bold' });

  const prize = d.place !== null && d.place >= 1 && d.place <= 3;
  drawText(ctx, prize ? `за ${ROMAN[d.place as number]} место` : 'участника', 665, 72);

  if (d.category) {
    drawText(ctx, `в возрастной категории: ${d.category}`, 745, 32, { style: 'italic bold', color: '#2e2a7a' });
  }

  drawText(ctx, d.fio, 890, 100, { style: 'italic bold', maxWidth: 820 });
  ctx.font = `italic bold 26px ${FONT}`;
  const instLines = wrapText(ctx, (d.institution || '').trim(), 760).slice(0, 3);
  const lines = [...instLines, (d.cityCountry || '').trim()].filter(Boolean);
  const startY = 985 - ((lines.length - 2) * 16);
  lines.forEach((line, i) => drawText(ctx, line, startY + i * 32, 26, { style: 'italic bold', color: '#333333', maxWidth: 780 }));

  if (d.coach) {
    drawText(ctx, 'Тренер:', 1185, 38);
    drawText(ctx, d.coach, 1247, 38, { maxWidth: 700 });
  }

  drawText(ctx, `Турнир: ${(d.ageCategory || '').replace(/\s*включительно/i, '')}`, 1327, 26, { maxWidth: 560 });
  drawText(ctx, `Рейтинг МШ: ${d.ratingLimit ? `до ${d.ratingLimit}` : 'без ограничений'}`, 1359, 26, { maxWidth: 560 });
  drawText(ctx, `Дата участия: ${formatDate(d.date)}`, 1391, 26, { maxWidth: 560 });

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось создать диплом'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
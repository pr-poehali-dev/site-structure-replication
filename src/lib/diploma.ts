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
  ratingLimit: string | null;
  date: string | null;
  textColor?: 'black' | 'white';
}

const TYPE_LABELS: Record<string, string> = {
  warmup: 'Разминочный турнир по шахматам',
  training: 'Тренировочный турнир по шахматам',
  qualifying: 'Всероссийский турнир по шахматам',
};

const ROMAN = ['', 'I', 'II', 'III'];
const CENTER_X = 894;
const LINE_X = 1002;
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

let whiteText = false;

function drawText(
  ctx: CanvasRenderingContext2D, text: string, y: number, size: number,
  opts: { style?: string; color?: string; maxWidth?: number; x?: number } = {},
) {
  if (!text) return;
  const maxWidth = opts.maxWidth ?? 900;
  let s = size;
  ctx.font = `${opts.style ?? 'bold'} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 1;
    ctx.font = `${opts.style ?? 'bold'} ${s}px ${FONT}`;
  }
  ctx.fillStyle = whiteText ? '#ffffff' : (opts.color ?? '#222222');
  ctx.fillText(text, opts.x ?? CENTER_X, y);
}

export async function renderDiploma(templateUrl: string, d: DiplomaData): Promise<Blob> {
  const img = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  const up = img.naturalWidth < 2000 ? 2 : 1;
  canvas.width = img.naturalWidth * up;
  canvas.height = img.naturalHeight * up;
  const k = canvas.width / 1414;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать диплом');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  whiteText = d.textColor === 'white';
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
  ctx.font = `italic bold 31px ${FONT}`;
  const instLines = wrapText(ctx, (d.institution || '').trim(), 820).slice(0, 3);
  const lines = [...instLines, (d.cityCountry || '').trim()].filter(Boolean);
  const startY = 985 - ((lines.length - 2) * 19);
  lines.forEach((line, i) => drawText(ctx, line, startY + i * 38, 31, { style: 'italic bold', color: '#333333', maxWidth: 840 }));

  if (d.coach) {
    drawText(ctx, 'Тренер:', 1185, 38, { x: LINE_X });
    drawText(ctx, d.coach, 1247, 38, { maxWidth: 700, x: LINE_X });
  }

  drawText(ctx, `Турнир: ${(d.ageCategory || '').replace(/\s*включительно/i, '')}`, 1327, 26, { maxWidth: 560, x: LINE_X });
  drawText(ctx, `Рейтинг МШ: ${d.ratingLimit?.trim() || 'без ограничений'}`, 1359, 26, { maxWidth: 560, x: LINE_X });
  drawText(ctx, `Дата участия: ${formatDate(d.date)}`, 1391, 26, { maxWidth: 560, x: LINE_X });

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

export interface ThanksData {
  tournamentType: string;
  tournamentTitle: string;
  place: number | null;
  participantFio: string;
  coachLastDative: string;
  coachNameDative: string;
  institution: string | null;
  cityCountry: string | null;
  ageCategory: string | null;
  ratingLimit: string | null;
  date: string | null;
  textColor?: 'black' | 'white';
}

export function splitCoachDative(coachFio: string | null, last: string | null, name: string | null) {
  const l = (last || '').trim();
  const n = (name || '').trim();
  if (l || n) return { last: l, name: n };
  const parts = (coachFio || '').trim().split(/\s+/);
  return { last: parts[0] || '', name: parts.slice(1).join(' ') };
}

export async function renderThanks(templateUrl: string, d: ThanksData): Promise<Blob> {
  const img = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  const up = img.naturalWidth < 2000 ? 2 : 1;
  canvas.width = img.naturalWidth * up;
  canvas.height = img.naturalHeight * up;
  const k = canvas.width / 1414;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать благодарственное письмо');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  whiteText = d.textColor === 'white';
  ctx.scale(k, k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  drawText(ctx, TYPE_LABELS[d.tournamentType] || 'Турнир по шахматам', 352, 42, { style: 'italic bold' });
  drawText(ctx, `«${d.tournamentTitle.replace(/^["«]|["»]$/g, '').trim()}»`, 405, 42, { style: 'italic bold' });

  drawText(ctx, d.coachLastDative, 830, 84, { style: 'italic bold', maxWidth: 820 });
  drawText(ctx, d.coachNameDative, 915, 72, { style: 'italic bold', maxWidth: 820 });

  ctx.font = `italic bold 30px ${FONT}`;
  const instLines = wrapText(ctx, (d.institution || '').trim(), 760).slice(0, 2);
  const lines = [...instLines, (d.cityCountry || '').trim()].filter(Boolean);
  lines.forEach((line, i) => drawText(ctx, line, 997 + i * 35, 30, { style: 'italic bold', color: '#333333', maxWidth: 780 }));

  const who = d.place === 1 ? 'победителя' : d.place !== null && d.place >= 2 && d.place <= 3 ? 'призёра' : 'участника';
  drawText(ctx, `За подготовку ${who} шахматного турнира`, 1175, 34, { style: 'italic bold', maxWidth: 820, x: LINE_X });
  drawText(ctx, d.participantFio, 1240, 52, { style: 'italic bold', maxWidth: 820, x: LINE_X });

  drawText(ctx, `Турнир: ${(d.ageCategory || '').replace(/\s*включительно/i, '')}`, 1327, 26, { maxWidth: 560, x: LINE_X });
  drawText(ctx, `Рейтинг МШ: ${d.ratingLimit?.trim() || 'без ограничений'}`, 1359, 26, { maxWidth: 560, x: LINE_X });
  drawText(ctx, `Дата участия: ${formatDate(d.date)}`, 1391, 26, { maxWidth: 560, x: LINE_X });

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось создать благодарственное письмо'))), 'image/png');
  });
}


export interface NominationDiplomaData {
  tournamentType?: string;
  tournamentTitle: string;
  nominationLabel: string;
  place: number | null;
  category: string | null;
  fio: string;
  institution: string | null;
  cityCountry: string | null;
  coach: string | null;
  ageCategory: string | null;
  ratingLimit: string | null;
  date: string | null;
  textColor?: 'black' | 'white';
  showPlace?: boolean;
}

export async function renderNominationDiploma(templateUrl: string, d: NominationDiplomaData): Promise<Blob> {
  const img = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  const up = img.naturalWidth < 2000 ? 2 : 1;
  canvas.width = img.naturalWidth * up;
  canvas.height = img.naturalHeight * up;
  const k = canvas.width / 1400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать диплом');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  whiteText = d.textColor === 'white';
  ctx.scale(k, k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = d.tournamentTitle.replace(/^["«]|["»]$/g, '').trim();
  const isQual = d.tournamentType === 'qualifying';
  ctx.font = `italic bold 36px ${FONT}`;
  const titleLines = wrapText(ctx, isQual ? `«${title}»` : title, 920).slice(0, 3);
  const allLines = isQual ? [TYPE_LABELS.qualifying, ...titleLines] : titleLines;
  const ty = 372 - ((allLines.length - 1) * 19);
  allLines.forEach((line, i) => drawText(ctx, line, ty + i * 38, 36, { style: 'italic bold', maxWidth: 940, x: 882 }));

  const placeNum = d.showPlace === false || d.place === null ? 1 : d.place;
  if (placeNum >= 1 && placeNum <= 3) {
    drawText(ctx, `за ${ROMAN[placeNum]} место`, 655, 64, { x: 893 });
  }
  drawText(ctx, `в номинации «${d.nominationLabel}»`, 727, 31, { style: 'italic bold', maxWidth: 840, x: 880 });
  if (d.category) {
    drawText(ctx, `в возрастной категории: ${d.category}`, 778, 28, { style: 'italic bold', maxWidth: 840, x: 880 });
  }

  drawText(ctx, d.fio, 925, 82, { style: 'italic bold', color: '#d2691e', maxWidth: 800, x: 886 });
  ctx.font = `italic bold 26px ${FONT}`;
  const instLines = wrapText(ctx, (d.institution || '').trim(), 640).slice(0, 3);
  const lines = [...instLines, (d.cityCountry || '').trim()].filter(Boolean);
  const startY = 1028 - ((lines.length - 2) * 15);
  lines.forEach((line, i) => drawText(ctx, line, startY + i * 31, 26, { style: 'italic bold', color: '#333333', maxWidth: 640, x: 882 }));

  if (d.coach) {
    drawText(ctx, 'Тренер:', 1197, 34, { x: 992 });
    drawText(ctx, d.coach, 1251, 34, { maxWidth: 650, x: 992 });
  }

  drawText(ctx, `Турнир: ${(d.ageCategory || '').replace(/\s*включительно/i, '')}`, 1330, 24, { maxWidth: 520, x: 992 });
  drawText(ctx, `Рейтинг МШ: ${d.ratingLimit?.trim() || 'без ограничений'}`, 1362, 24, { maxWidth: 520, x: 992 });
  drawText(ctx, `Дата участия: ${formatDate(d.date)}`, 1394, 24, { maxWidth: 520, x: 992 });

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось создать диплом'))), 'image/png');
  });
}

const SERIF = '"Noto Serif", "Times New Roman", Times, serif';
const SANS = '"Golos Text", Arial, sans-serif';
const NAVY = '#1a2f6b';
const BLUE = '#3B82F6';
const ORANGE = '#FF8A1F';
const W = 1240;
const H = 1754;

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const ROMAN = ['', 'I', 'II', 'III'];
const MEDALS = ['', '/medals/medal-gold-v2.png', '/medals/medal-silver-v2.png', '/medals/medal-bronze-v2.png'];

export interface ActivistCertificateData {
  fio: string;
  month: string;
  place: number;
  points: number;
}

export function monthTitle(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { genitive: MONTHS_GEN[m - 1], prepositional: MONTHS_PREP[m - 1], year: y };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение грамоты'));
    img.src = url;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, size: number, maxWidth: number) {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxWidth && s > 20) {
    s -= 2;
    ctx.font = font(s);
  }
}

export async function renderActivistCertificate(d: ActivistCertificateData): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`bold 100px "Noto Serif"`),
    document.fonts.load(`italic bold 100px "Noto Serif"`),
    document.fonts.load(`italic 30px "Noto Serif"`),
    document.fonts.load(`30px "Noto Serif"`),
    document.fonts.load(`bold 30px "Golos Text"`),
  ]).catch(() => undefined);

  const [header, footer, stamp, medal] = await Promise.all([
    loadImage('/diploma/activist/header.png'),
    loadImage('/diploma/activist/footer.png'),
    loadImage('/diploma/activist/stamp.png'),
    loadImage(MEDALS[d.place] || MEDALS[3]),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать грамоту');

  ctx.fillStyle = '#F3F7FF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(37, 37, W - 74, H - 74, 8);
  ctx.stroke();
  ctx.strokeStyle = '#A8C8FA';
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 52, W - 104, H - 104);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(70, 70, 1100, 1614);
  ctx.drawImage(header, 70, 70);
  ctx.drawImage(footer, 70, 1604);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;

  ctx.fillStyle = NAVY;
  ctx.font = `bold 190px ${SERIF}`;
  ctx.fillText('ГРАМОТА', cx, 440);

  ctx.fillStyle = ORANGE;
  ctx.font = `italic bold 48px ${SERIF}`;
  ctx.fillText(`за ${ROMAN[d.place]} место`, cx, 548);

  const mt = monthTitle(d.month);
  const pill = `НОМИНАЦИЯ «АКТИВИСТ ${mt.genitive.toUpperCase()}»`;
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.roundRect(265, 606, 710, 73, 36);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  fitText(ctx, pill, s => `bold ${s}px ${SANS}`, 31, 640);
  ctx.fillText(pill, cx, 643);

  ctx.drawImage(medal, cx - 98, 686, 196, 196);

  ctx.fillStyle = '#555555';
  ctx.font = `italic 36px ${SERIF}`;
  ctx.fillText('награждается', cx, 920);

  ctx.fillStyle = NAVY;
  fitText(ctx, d.fio, s => `italic bold ${s}px ${SERIF}`, 84, 900);
  ctx.fillText(d.fio, cx, 1015);

  ctx.fillStyle = BLUE;
  ctx.fillRect(160, 1078, 920, 4);

  ctx.fillStyle = '#333333';
  ctx.font = `35px ${SERIF}`;
  ctx.fillText('за высокую активность на платформе «Мир шахмат»', cx, 1135);
  ctx.fillText(`в ${mt.prepositional} ${mt.year} года`, cx, 1185);

  ctx.font = `35px ${SERIF}`;
  const label = 'Очков активности: ';
  const num = String(d.points);
  ctx.font = `35px ${SERIF}`;
  const lw = ctx.measureText(label).width;
  ctx.font = `bold 40px ${SERIF}`;
  const nw = ctx.measureText(num).width;
  const startX = cx - (lw + nw) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#333333';
  ctx.font = `35px ${SERIF}`;
  ctx.fillText(label, startX, 1243);
  ctx.fillStyle = BLUE;
  ctx.font = `bold 40px ${SERIF}`;
  ctx.fillText(num, startX + lw, 1243);

  ctx.fillStyle = '#555555';
  ctx.font = `26px ${SERIF}`;
  ctx.fillText('Руководитель', 130, 1433);
  ctx.fillText('ЦПДШС «МИР ШАХМАТ»', 130, 1475);
  ctx.fillStyle = NAVY;
  ctx.font = `bold 32px ${SERIF}`;
  ctx.fillText('Мозжерин И.В.', 130, 1520);

  ctx.drawImage(stamp, 480, 1370);

  const [yy, mm] = d.month.split('-').map(Number);
  const nextY = mm === 12 ? yy + 1 : yy;
  const nextM = mm === 12 ? 1 : mm + 1;
  const dateStr = `01.${String(nextM).padStart(2, '0')}.${nextY} г.`;
  ctx.textAlign = 'right';
  ctx.fillStyle = BLUE;
  ctx.font = `bold 29px ${SERIF}`;
  ctx.fillText('мир-шахмат.рф', 1110, 1462);
  ctx.fillStyle = '#666666';
  ctx.font = `23px ${SERIF}`;
  ctx.fillText(`Дата вручения: ${dateStr}`, 1110, 1501);

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось создать грамоту'))), 'image/png');
  });
}

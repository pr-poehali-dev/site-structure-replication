import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import FileSlot from './FileSlot';
import { toast } from 'sonner';
import { renderDiploma, renderThanks, renderNominationDiploma, splitCoachDative } from '@/lib/diploma';
import {
  ELECTRONIC_RESULTS_URL, NOMINATIONS, AgeGroup, NominationKind, ResultRow, ResultsSnapshot, ResultFile,
} from '@/lib/electronicResults';

interface Props {
  password: string;
}

interface TournamentItem { id: number; title: string; date: string | null; result_status: string }

interface SampleProfile {
  institution: string | null; country_city: string | null; coach_fio: string | null;
  fio_genitive: string | null; coach_last_dative: string | null; coach_name_dative: string | null;
}

interface NominationDraft { group_name: string; kind: NominationKind; place: number; username: string; game_url: string }

const STATUS_LABELS: Record<string, string> = { published: 'Опубликовано', draft: 'Черновик' };

export default function ElectronicResultsSection({ password }: Props) {
  const [items, setItems] = useState<TournamentItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [players, setPlayers] = useState<ResultRow[]>([]);
  const [groups, setGroups] = useState<AgeGroup[]>([]);
  const [noms, setNoms] = useState<NominationDraft[]>([]);
  const [status, setStatus] = useState('draft');
  const [preview, setPreview] = useState<ResultsSnapshot | null>(null);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [ratingLimit, setRatingLimit] = useState('');
  const [tInfo, setTInfo] = useState<{ type: string; age_category: string | null; date: string | null }>({ type: 'qualifying', age_category: null, date: null });
  const [profiles, setProfiles] = useState<Record<string, SampleProfile>>({});
  const [sampleUserId, setSampleUserId] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [textColor, setTextColor] = useState<'black' | 'white'>('black');
  const [nomRatingLimit, setNomRatingLimit] = useState('');
  const [nomTextColor, setNomTextColor] = useState<'black' | 'white'>('black');
  const [awardsEnabled, setAwardsEnabled] = useState(true);
  const [thanksRatingLimit, setThanksRatingLimit] = useState('');
  const [thanksTextColor, setThanksTextColor] = useState<'black' | 'white'>('black');

  const headers = { 'Content-Type': 'application/json', 'X-Admin-Password': password };

  function loadList() {
    setLoadingList(true);
    fetch(`${ELECTRONIC_RESULTS_URL}?admin=1`, { headers })
      .then(r => r.json())
      .then(d => setItems(d.tournaments || []))
      .finally(() => setLoadingList(false));
  }

  useEffect(loadList, []);

  async function openTournament(id: number) {
    setCurrentId(id);
    setLoading(true);
    const res = await fetch(`${ELECTRONIC_RESULTS_URL}?admin=1&tournament_id=${id}`, { headers });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error || 'Не удалось загрузить результаты');
      setCurrentId(null);
      return;
    }
    setTitle(data.tournament.title);
    setTInfo({ type: data.tournament.type || 'qualifying', age_category: data.tournament.age_category || null, date: data.tournament.date || null });
    setPlayers(data.players || []);
    setGroups(data.config.age_groups || []);
    setNoms((data.config.nominations || []).map((n: NominationDraft) => ({ ...n, game_url: n.game_url || '' })));
    setStatus(data.config.status || 'draft');
    setPreview(data.preview);
    setFiles(data.files || []);
    setProfiles(data.profiles || {});
    setSampleUserId('');
    setTextColor(data.config.diploma_text_color === 'white' ? 'white' : 'black');
    setRatingLimit(data.config.diploma_rating_limit != null ? String(data.config.diploma_rating_limit) : '');
    setNomTextColor(data.config.nom_text_color === 'white' ? 'white' : 'black');
    setNomRatingLimit(data.config.nom_rating_limit != null ? String(data.config.nom_rating_limit) : '');
    setAwardsEnabled(data.config.awards_enabled !== false);
    setThanksTextColor(data.config.thanks_text_color === 'white' ? 'white' : 'black');
    setThanksRatingLimit(data.config.thanks_rating_limit != null ? String(data.config.thanks_rating_limit) : '');
  }

  async function reloadFiles() {
    if (currentId) await openTournament(currentId);
  }

  async function send(action: 'save' | 'publish' | 'unpublish', awardsOverride?: boolean) {
    if (!currentId) return;
    setSaving(true);
    const res = await fetch(ELECTRONIC_RESULTS_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ _action: action, tournament_id: currentId, age_groups: groups, nominations: noms, diploma_rating_limit: ratingLimit, diploma_text_color: textColor, thanks_rating_limit: thanksRatingLimit, thanks_text_color: thanksTextColor, nom_rating_limit: nomRatingLimit, nom_text_color: nomTextColor, awards_enabled: awardsOverride ?? awardsEnabled }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Не удалось сохранить');
      return;
    }
    toast.success(action === 'publish' ? 'Результаты опубликованы' : action === 'unpublish' ? 'Публикация снята' : 'Сохранено');
    await openTournament(currentId);
    loadList();
  }

  function updateGroup(i: number, patch: Partial<AgeGroup>) {
    setGroups(gs => gs.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  function removeGroup(i: number) {
    const name = groups[i].name;
    setGroups(gs => gs.filter((_, idx) => idx !== i));
    setNoms(ns => ns.filter(n => n.group_name !== name));
  }

  function slot(username: string, kind: string, label: string) {
    return currentId ? (
      <FileSlot tournamentId={currentId} password={password} username={username} kind={kind} label={label} files={files} onChanged={reloadFiles} />
    ) : null;
  }

  function getNom(group: string, kind: NominationKind, place: number) {
    return noms.find(n => n.group_name === group && n.kind === kind && n.place === place);
  }

  function setNom(group: string, kind: NominationKind, place: number, patch: Partial<NominationDraft>) {
    setNoms(ns => {
      const existing = ns.find(n => n.group_name === group && n.kind === kind && n.place === place);
      if (existing) {
        const next = { ...existing, ...patch };
        if (!next.username) return ns.filter(n => n !== existing);
        return ns.map(n => (n === existing ? next : n));
      }
      if (!patch.username) return ns;
      return [...ns, { group_name: group, kind, place, username: '', game_url: '', ...patch }];
    });
  }

  function candidates(group: AgeGroup, kind: NominationKind) {
    return players.filter(p => {
      if (p.age === null || p.age < group.min || p.age > group.max) return false;
      return kind === 'best_woman' ? p.gender === 'F' : true;
    });
  }

  if (currentId === null) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-heading font-bold text-xl text-primary mb-1">Электронные результаты</h2>
        <p className="text-sm text-gray-500 mb-4">Выберите турнир со ссылкой на Lila, чтобы оформить итоги.</p>
        {loadingList ? (
          <Icon name="Loader2" size={20} className="animate-spin text-gray-400" />
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-sm">Нет турниров со ссылкой на Lila</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(t => (
              <button key={t.id} onClick={() => openTournament(t.id)}
                className="flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-secondary transition-colors">
                <span className="font-medium text-gray-800">{t.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${t.result_status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABELS[t.result_status] || 'Не оформлено'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const templateFile = files.find(f => f.kind === 'diploma_template');

  const samplePlayers = players.filter(p => p.user_id);
  const samplePlayer = samplePlayers.find(p => String(p.user_id) === sampleUserId) || samplePlayers[0] || null;
  const sampleProfile = samplePlayer?.user_id ? profiles[String(samplePlayer.user_id)] : undefined;
  const sampleGroup = samplePlayer ? groups.find(g => g.name === samplePlayer.group) : undefined;
  const sampleGroupRow = preview?.groups.find(g => g.name === samplePlayer?.group)?.table.find(r => r.user_id === samplePlayer?.user_id);
  const samplePlace = sampleGroupRow?.place ?? samplePlayer?.rank ?? 1;

  const showSample = async () => {
    if (!templateFile) return;
    setPreviewing(true);
    try {
      const blob = await renderDiploma(templateFile.file_url, {
        tournamentType: tInfo.type,
        tournamentTitle: title,
        place: samplePlace,
        category: sampleGroup?.name || null,
        fio: samplePlayer?.fio || 'Мозжерин Иван',
        institution: sampleProfile?.institution || 'МБОУ СОШ № 1',
        cityCountry: sampleProfile?.country_city || 'Москва, Россия',
        coach: sampleProfile?.coach_fio || 'Иванов Иван Иванович',
        ageCategory: tInfo.age_category,
        ratingLimit: ratingLimit.trim() || null,
        textColor,
        date: tInfo.date,
      });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось собрать образец');
    }
    setPreviewing(false);
  };

  const thanksTemplateFile = files.find(f => f.kind === 'thanks_template');

  const showThanksSample = async () => {
    if (!thanksTemplateFile) return;
    setPreviewing(true);
    try {
      const c = splitCoachDative(sampleProfile?.coach_fio || 'Иванов Иван Иванович', sampleProfile?.coach_last_dative ?? null, sampleProfile?.coach_name_dative ?? null);
      const blob = await renderThanks(thanksTemplateFile.file_url, {
        tournamentType: tInfo.type,
        tournamentTitle: title,
        place: samplePlace,
        participantFio: (sampleProfile?.fio_genitive || '').trim() || samplePlayer?.fio || 'Ивановой Марии',
        coachLastDative: c.last,
        coachNameDative: c.name,
        institution: sampleProfile?.institution || 'МБОУ СОШ № 1',
        cityCountry: sampleProfile?.country_city || 'Москва, Россия',
        ageCategory: tInfo.age_category,
        ratingLimit: thanksRatingLimit.trim() || null,
        textColor: thanksTextColor,
        date: tInfo.date,
      });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось собрать образец');
    }
    setPreviewing(false);
  };

  const nomTemplateFile = files.find(f => f.kind === 'nom_template');

  const showNomSample = async () => {
    if (!nomTemplateFile) return;
    setPreviewing(true);
    try {
      const uname = samplePlayer?.username.toLowerCase();
      const own = sampleGroup ? sampleGroup.name : null;
      const nm = noms.find(n => n.username.toLowerCase() === uname) || noms[0];
      const def = NOMINATIONS.find(x => x.kind === nm?.kind) || NOMINATIONS[0];
      const blob = await renderNominationDiploma(nomTemplateFile.file_url, {
        tournamentTitle: title,
        nominationLabel: def.label,
        place: nm?.place ?? 1,
        category: nm?.group_name || own,
        fio: samplePlayer?.fio || 'Иванова Мария',
        institution: sampleProfile?.institution || 'МБОУ СОШ № 1',
        cityCountry: sampleProfile?.country_city || 'Москва, Россия',
        coach: sampleProfile?.coach_fio || 'Иванов Иван Иванович',
        ageCategory: tInfo.age_category,
        ratingLimit: nomRatingLimit.trim() || null,
        textColor: nomTextColor,
        date: tInfo.date,
        showPlace: def.places > 1,
      });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось собрать образец');
    }
    setPreviewing(false);
  };

  const noAge = players.filter(p => p.age === null).length;
  const noGender = players.filter(p => !p.gender).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Наградные документы для участников</p>
          <p className="text-xs text-gray-400">{awardsEnabled ? 'Включено: участники могут скачать диплом, письмо и дипломы номинаций' : 'Выключено: наградные документы у участников не отображаются'}</p>
        </div>
        <Switch checked={awardsEnabled} disabled={saving || loading} onCheckedChange={v => { setAwardsEnabled(v); send('save', v); }} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => { setCurrentId(null); setPreview(null); }} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-1">
            <Icon name="ArrowLeft" size={14} /> К списку турниров
          </button>
          <h2 className="font-heading font-bold text-xl text-primary">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Статус: {STATUS_LABELS[status] || status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving || loading} onClick={() => send('save')}>
            <Icon name="Save" size={15} className="mr-2" /> Сохранить
          </Button>
          <Button disabled={saving || loading} onClick={() => send('publish')} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Icon name="Send" size={15} className="mr-2" /> {status === 'published' ? 'Обновить публикацию' : 'Опубликовать'}
          </Button>
          {status === 'published' && (
            <Button variant="outline" disabled={saving} onClick={() => send('unpublish')}>Снять с публикации</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Icon name="Loader2" size={28} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          {(noAge > 0 || noGender > 0) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
              {noAge > 0 && <p>У {noAge} участников нет даты рождения или аккаунта, они не попадут в возрастные таблицы. Заполните дату рождения в разделе «Участники».</p>}
              {noGender > 0 && <p>У {noGender} участников не указан пол, для номинации «Лучшая шахматистка» он нужен.</p>}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-heading font-bold text-base text-primary mb-2">Протокол турнира</h3>
            {slot('_tournament', 'protocol', 'Загрузить протокол')}
            <p className="text-xs text-gray-400 mt-2">PDF, PNG или JPG до 8 МБ. Появится на странице результатов и в личном кабинете участников.</p>
          </div>

          {samplePlayers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Образец строится на участнике:</span>
              <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm max-w-xs" value={String(samplePlayer?.user_id || '')} onChange={e => setSampleUserId(e.target.value)}>
                {samplePlayers.map(p => <option key={p.user_id} value={String(p.user_id)}>{p.fio}</option>)}
              </select>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-heading font-bold text-base text-primary mb-2">Шаблон диплома для номинаций</h3>
            <div className="flex flex-wrap items-center gap-2">
              {slot('_tournament', 'nom_template', 'Загрузить шаблон диплома номинации')}
              {nomTemplateFile && (
                <Button type="button" variant="outline" disabled={previewing} onClick={showNomSample}>
                  <Icon name={previewing ? 'Loader2' : 'Eye'} size={15} className={`mr-2 ${previewing ? 'animate-spin' : ''}`} /> Посмотреть образец
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Рейтинг МШ:</span>
              <Input className="w-48" type="text" maxLength={100} placeholder="например: от 1000 или до 800" value={nomRatingLimit} onChange={e => setNomRatingLimit(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Цвет текста:</span>
              {(['black', 'white'] as const).map(c => (
                <button key={c} type="button" onClick={() => setNomTextColor(c)}
                  className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-2 ${nomTextColor === c ? 'border-secondary ring-2 ring-secondary/40 font-semibold' : 'border-gray-300 hover:border-secondary'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full border border-gray-400 ${c === 'white' ? 'bg-white' : 'bg-black'}`} />
                  {c === 'white' ? 'Белый' : 'Чёрный'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Один бланк для всех номинаций. Название номинации, место и данные участника подставляются автоматически. Образец строится по участнику, у которого есть номинация. Не забудьте нажать «Сохранить».</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-heading font-bold text-base text-primary mb-2">Шаблон благодарственного письма</h3>
            <div className="flex flex-wrap items-center gap-2">
              {slot('_tournament', 'thanks_template', 'Загрузить шаблон письма')}
              {thanksTemplateFile && (
                <Button type="button" variant="outline" disabled={previewing} onClick={showThanksSample}>
                  <Icon name={previewing ? 'Loader2' : 'Eye'} size={15} className={`mr-2 ${previewing ? 'animate-spin' : ''}`} /> Посмотреть образец
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Рейтинг МШ:</span>
              <Input className="w-48" type="text" maxLength={100} placeholder="например: от 1000 или до 800" value={thanksRatingLimit} onChange={e => setThanksRatingLimit(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Цвет текста:</span>
              {(['black', 'white'] as const).map(c => (
                <button key={c} type="button" onClick={() => setThanksTextColor(c)}
                  className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-2 ${thanksTextColor === c ? 'border-secondary ring-2 ring-secondary/40 font-semibold' : 'border-gray-300 hover:border-secondary'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full border border-gray-400 ${c === 'white' ? 'bg-white' : 'bg-black'}`} />
                  {c === 'white' ? 'Белый' : 'Чёрный'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Пустой бланк PNG или JPG до 8 МБ. Письмо получает участник, у которого в профиле указан тренер. Не забудьте нажать «Сохранить».</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-heading font-bold text-base text-primary mb-2">Шаблон диплома</h3>
            <div className="flex flex-wrap items-center gap-2">
              {slot('_tournament', 'diploma_template', 'Загрузить шаблон диплома')}
              {templateFile && (
                <Button type="button" variant="outline" disabled={previewing} onClick={showSample}>
                  <Icon name={previewing ? 'Loader2' : 'Eye'} size={15} className={`mr-2 ${previewing ? 'animate-spin' : ''}`} /> Посмотреть образец
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Рейтинг МШ:</span>
              <Input className="w-48" type="text" maxLength={100} placeholder="например: от 1000 или до 800" value={ratingLimit} onChange={e => setRatingLimit(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600">Цвет текста:</span>
              {(['black', 'white'] as const).map(c => (
                <button key={c} type="button" onClick={() => setTextColor(c)}
                  className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-2 ${textColor === c ? 'border-secondary ring-2 ring-secondary/40 font-semibold' : 'border-gray-300 hover:border-secondary'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full border border-gray-400 ${c === 'white' ? 'bg-white' : 'bg-black'}`} />
                  {c === 'white' ? 'Белый' : 'Чёрный'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Пустой бланк PNG или JPG до 8 МБ. Поля заполняются автоматически, когда участник нажимает «Скачать диплом». Не забудьте нажать «Сохранить».</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-base text-primary">Возрастные группы</h3>
              <Button variant="outline" size="sm" onClick={() => setGroups(gs => [...gs, { name: '', min: 0, max: 0 }])}>
                <Icon name="Plus" size={14} className="mr-1" /> Добавить группу
              </Button>
            </div>
            {groups.length === 0 && <p className="text-sm text-gray-400">Добавьте группы, например «до 9 лет»: от 0 до 8.</p>}
            <div className="flex flex-col gap-2">
              {groups.map((g, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input className="w-full sm:w-56" placeholder="Название" value={g.name} onChange={e => updateGroup(i, { name: e.target.value })} />
                  <span className="text-sm text-gray-500">от</span>
                  <Input className="w-20" type="number" min={0} value={g.min} onChange={e => updateGroup(i, { min: Number(e.target.value) })} />
                  <span className="text-sm text-gray-500">до</span>
                  <Input className="w-20" type="number" min={0} value={g.max} onChange={e => updateGroup(i, { max: Number(e.target.value) })} />
                  <span className="text-sm text-gray-500">лет</span>
                  <Button variant="ghost" size="sm" onClick={() => removeGroup(i)}><Icon name="Trash2" size={15} className="text-red-500" /></Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">После изменения групп нажмите «Сохранить», чтобы обновить списки участников.</p>
          </div>

          {groups.filter(g => g.name.trim()).map(g => (
            <div key={g.name} className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-heading font-bold text-base text-primary mb-3">
                {g.name} <span className="text-gray-400 font-normal text-sm">({candidates(g, 'best_mate').length} участников)</span>
              </h3>
              <div className="flex flex-col gap-4">
                {NOMINATIONS.map(nom => (
                  <div key={nom.kind}>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      {nom.label}
                      
                    </p>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: nom.places }, (_, idx) => idx + 1).map(place => {
                        const cur = getNom(g.name, nom.kind, place);
                        return (
                          <div key={place} className="flex flex-wrap items-center gap-2">
                            {nom.places > 1 && <span className="text-sm text-gray-500 w-16">{place} место</span>}
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-64"
                              value={cur?.username || ''}
                              onChange={e => setNom(g.name, nom.kind, place, { username: e.target.value })}
                            >
                              <option value="">Не выбрано</option>
                              {candidates(g, nom.kind).map(p => (
                                <option key={p.username} value={p.username}>{p.fio}</option>
                              ))}
                            </select>
                            {cur && slot(cur.username, `nom_${nom.kind}`, 'Диплом номинации')}
                            {!['best_woman', 'courage', 'young_talent'].includes(nom.kind) && cur && (
                              <Input className="w-full sm:w-72" placeholder="Ссылка на партию (необязательно)" value={cur.game_url}
                                onChange={e => setNom(g.name, nom.kind, place, { game_url: e.target.value })} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {preview && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-heading font-bold text-base text-primary mb-3">Общая таблица ({preview.overall.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-400 border-b"><th className="py-2 pr-3">№</th><th className="pr-3">Участник</th><th className="pr-3">Возраст</th><th className="pr-3">Очки</th><th>Диплом и письмо</th></tr></thead>
                  <tbody>
                    {preview.overall.map(r => (
                      <tr key={r.username} className="border-b border-gray-50">
                        <td className="py-1.5 pr-3">{r.rank}</td>
                        <td className="pr-3">{r.fio}</td>
                        <td className="pr-3">{r.age ?? '—'}</td>
                        <td className="pr-3">{r.points}</td>
                        <td>
                          {r.user_id !== null ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {slot(r.username, 'diploma', 'Диплом')}
                              {slot(r.username, 'thanks', 'Письмо')}
                            </div>
                          ) : <span className="text-gray-300 text-xs">нет аккаунта</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && groups.filter(g => g.name.trim()).map(g => {
            const rows = preview.overall.filter(r => r.age !== null && r.age >= g.min && r.age <= g.max);
            return (
              <div key={g.name} className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-heading font-bold text-base text-primary mb-3">{g.name} ({rows.length})</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-400">В этой категории нет участников</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-400 border-b"><th className="py-2 pr-3">№</th><th className="pr-3">Участник</th><th className="pr-3">Возраст</th><th>Очки</th></tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.username} className="border-b border-gray-50">
                            <td className="py-1.5 pr-3">{i + 1}</td>
                            <td className="pr-3">{r.fio}</td>
                            <td className="pr-3">{r.age}</td>
                            <td>{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

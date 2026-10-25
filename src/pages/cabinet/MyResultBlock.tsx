import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { renderDiploma, renderThanks, renderNominationDiploma, splitCoachDative, downloadBlob } from '@/lib/diploma';
import { ELECTRONIC_RESULTS_URL, NOMINATIONS, ResultFile, ResultsSnapshot } from '@/lib/electronicResults';

interface DiplomaInfo {
  template_url: string | null;
  thanks_template_url?: string | null;
  rating_limit: string | null;
  text_color?: 'black' | 'white';
  thanks_rating_limit?: string | null;
  nom_template_url?: string | null;
  nom_rating_limit?: string | null;
  nom_text_color?: 'black' | 'white';
  awards_enabled?: boolean;
  thanks_text_color?: 'black' | 'white';
  tournament: { title: string; type: string; age_category: string | null; date: string | null };
  profile: { institution: string | null; country_city: string | null; coach_fio: string | null; fio_genitive?: string | null; coach_last_dative?: string | null; coach_name_dative?: string | null };
}

interface Props {
  tournamentId: number;
}

export default function MyResultBlock({ tournamentId }: Props) {
  const { user, token } = useAuth();
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [snap, setSnap] = useState<ResultsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [diplomaInfo, setDiplomaInfo] = useState<DiplomaInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setSnap(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId]);

  useEffect(() => {
    if (!token) return;
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}&my_files=1`, { headers: { 'X-Auth-Token': token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setFiles(d?.files || []))
      .catch(() => {});
  }, [tournamentId, token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}&diploma_data=1`, { headers: { 'X-Auth-Token': token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setDiplomaInfo(d))
      .catch(() => {});
  }, [tournamentId, token]);

  const hasTemplate = !!diplomaInfo?.template_url;

  async function handleGenerate() {
    if (!diplomaInfo?.template_url || !snap || !user) return;
    const mine = snap.overall.find(r => r.user_id === user.id);
    if (!mine) return;
    const grp = snap.groups.find(g => g.name === mine.group);
    const grpRow = grp?.table.find(r => r.user_id === user.id);
    setGenerating(true);
    try {
      const blob = await renderDiploma(diplomaInfo.template_url, {
        tournamentType: diplomaInfo.tournament.type,
        tournamentTitle: diplomaInfo.tournament.title,
        place: grpRow ? grpRow.place ?? null : mine.rank,
        category: grp ? grp.name : null,
        fio: mine.fio,
        institution: diplomaInfo.profile.institution,
        cityCountry: diplomaInfo.profile.country_city,
        coach: diplomaInfo.profile.coach_fio,
        ageCategory: diplomaInfo.tournament.age_category,
        ratingLimit: diplomaInfo.rating_limit,
        textColor: diplomaInfo.text_color === 'white' ? 'white' : 'black',
        date: diplomaInfo.tournament.date,
      });
      downloadBlob(blob, `Диплом - ${mine.fio}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать диплом');
    }
    setGenerating(false);
  }

  async function handleGenerateThanks() {
    if (!diplomaInfo?.thanks_template_url || !snap || !user) return;
    const mine = snap.overall.find(r => r.user_id === user.id);
    if (!mine) return;
    const grp = snap.groups.find(g => g.name === mine.group);
    const grpRow = grp?.table.find(r => r.user_id === user.id);
    const c = splitCoachDative(diplomaInfo.profile.coach_fio, diplomaInfo.profile.coach_last_dative ?? null, diplomaInfo.profile.coach_name_dative ?? null);
    setGenerating(true);
    try {
      const blob = await renderThanks(diplomaInfo.thanks_template_url, {
        tournamentType: diplomaInfo.tournament.type,
        tournamentTitle: diplomaInfo.tournament.title,
        place: grpRow ? grpRow.place ?? null : mine.rank,
        participantFio: (diplomaInfo.profile.fio_genitive || '').trim() || mine.fio,
        coachLastDative: c.last,
        coachNameDative: c.name,
        institution: diplomaInfo.profile.institution,
        cityCountry: diplomaInfo.profile.country_city,
        ageCategory: diplomaInfo.tournament.age_category,
        ratingLimit: diplomaInfo.thanks_rating_limit ?? null,
        textColor: diplomaInfo.thanks_text_color === 'white' ? 'white' : 'black',
        date: diplomaInfo.tournament.date,
      });
      downloadBlob(blob, `Благодарственное письмо - ${mine.fio}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать письмо');
    }
    setGenerating(false);
  }

  async function handleGenerateNom(kind: string) {
    if (!diplomaInfo?.nom_template_url || !snap || !user) return;
    const mine = snap.overall.find(r => r.user_id === user.id);
    if (!mine) return;
    const grp = snap.groups.find(g => g.name === mine.group);
    const entry = grp ? NOMINATIONS.flatMap(n => (grp.nominations[n.kind] || [])
      .filter(e => e.username.toLowerCase() === mine.username.toLowerCase())
      .map(e => ({ n, e }))).find(x => x.n.kind === kind) : undefined;
    if (!entry) return;
    setGenerating(true);
    try {
      const blob = await renderNominationDiploma(diplomaInfo.nom_template_url, {
        tournamentTitle: diplomaInfo.tournament.title,
        nominationLabel: entry.n.label,
        place: entry.e.place,
        showPlace: entry.n.places > 1,
        category: grp ? grp.name : null,
        fio: mine.fio,
        institution: diplomaInfo.profile.institution,
        cityCountry: diplomaInfo.profile.country_city,
        coach: diplomaInfo.profile.coach_fio,
        ageCategory: diplomaInfo.tournament.age_category,
        ratingLimit: diplomaInfo.nom_rating_limit ?? null,
        textColor: diplomaInfo.nom_text_color === 'white' ? 'white' : 'black',
        date: diplomaInfo.tournament.date,
      });
      downloadBlob(blob, `Диплом номинации - ${mine.fio}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать диплом');
    }
    setGenerating(false);
  }

  if (loading) {
    return <p className="text-xs text-gray-400 flex items-center gap-2"><Icon name="Loader2" size={14} className="animate-spin" /> Загружаем ваш результат...</p>;
  }
  if (!snap || !user) return null;

  const protocolUrl = snap.tournament.protocol_url;
  const protocolLink = protocolUrl ? (
    <a href={protocolUrl} target="_blank" rel="noopener noreferrer" download
      className="text-xs px-3 py-1.5 rounded-full font-semibold bg-white border border-primary/30 text-primary hover:bg-primary/5 inline-flex items-center gap-1.5 self-start">
      <Icon name="FileText" size={13} /> Протокол турнира
    </a>
  ) : null;

  const me = snap.overall.find(r => r.user_id === user.id);
  if (!me) return protocolLink;

  const group = snap.groups.find(g => g.name === me.group);
  const groupRow = group?.table.find(r => r.user_id === user.id);
  const noms = group
    ? NOMINATIONS.flatMap(n =>
        (group.nominations[n.kind] || [])
          .filter(e => e.username.toLowerCase() === me.username.toLowerCase())
          .map(e => ({ label: n.label, place: e.place, places: n.places, kind: n.kind }))
      )
    : [];

  const manualDiploma = files.find(f => f.kind === 'diploma');
  const docs: { key: string; label: string; url: string | null }[] = [];
  if (manualDiploma) docs.push({ key: 'diploma', label: 'Диплом', url: manualDiploma.file_url });
  else if (hasTemplate) docs.push({ key: 'diploma', label: 'Диплом', url: null });
  const manualThanks = files.filter(f => f.kind === 'thanks');
  manualThanks.forEach(f => docs.push({ key: 'thanks', label: 'Благодарственное письмо', url: f.file_url }));
  if (!manualThanks.length && diplomaInfo?.thanks_template_url && (diplomaInfo.profile.coach_fio || '').trim()) {
    docs.push({ key: 'thanks', label: 'Благодарственное письмо', url: null });
  }
  noms.forEach((n, i) => {
    const f = files.find(x => x.kind === `nom_${n.kind}`);
    if (f) docs.push({ key: `nom${i}`, label: `Диплом: ${n.label}`, url: f.file_url });
    else if (diplomaInfo?.nom_template_url) docs.push({ key: `nom:${n.kind}`, label: `Диплом: ${n.label}`, url: null });
  });
  if (diplomaInfo?.awards_enabled === false) docs.length = 0;

  return (
    <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ваш результат</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
        <span className="flex items-center gap-2">
          <Icon name="Trophy" size={14} className="text-secondary shrink-0" />
          Общий зачёт: <b className="text-primary">{me.rank ? `${me.rank}-е место` : '—'}</b>
          <span className="text-gray-400">({me.points} очк.)</span>
        </span>
        {group && groupRow && (
          <span className="flex items-center gap-2">
            <Icon name="Users" size={14} className="text-secondary shrink-0" />
            {group.name}: <b className="text-primary">{groupRow.place}-е место</b>
          </span>
        )}
      </div>
      {docs.length > 0 && (
        <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Icon name="Award" size={13} className="text-secondary" /> Наградные документы
          </p>
          <div className="flex flex-col divide-y divide-gray-100">
            {docs.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                  <Icon name="FileText" size={15} className="text-secondary shrink-0" />
                  <span className="truncate">{d.label}</span>
                </span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" download
                    className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shrink-0">
                    <Icon name="Download" size={13} /> Скачать
                  </a>
                ) : (
                  <button type="button" onClick={d.key === 'thanks' ? handleGenerateThanks : d.key.startsWith('nom:') ? () => handleGenerateNom(d.key.slice(4)) : handleGenerate} disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shrink-0 disabled:opacity-60">
                    <Icon name={generating ? 'Loader2' : 'Download'} size={13} className={generating ? 'animate-spin' : ''} /> Скачать
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {protocolLink}
      {noms.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {noms.map((n, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white border border-secondary/40 text-primary flex items-center gap-1">
              <Icon name="Award" size={12} className="text-secondary" />
              {n.label}{n.places > 1 ? `, ${n.place}-е место` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

const TOURNAMENTS_URL = 'https://functions.poehali.dev/9a8eb98d-1a35-4b77-9828-603a76a903ed';
const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';
const AWARD_CATALOG_ADMIN_URL = 'https://functions.poehali.dev/6d39bfe8-ce2f-4ed5-821a-a3784713fcdd';
const AWARD_ORDERS_URL = 'https://functions.poehali.dev/572ab5d3-bfa9-4a78-8d49-a35187da0bb7';
const AWARD_TOURNAMENTS_URL = 'https://functions.poehali.dev/fd3814c3-2340-45ce-81f9-80e07768efe2';

interface Tournament {
  id: number; title: string; description: string; date: string | null;
  location: string; age_category: string; price: number | null; fsr_id: string; created_at: string;
  status: string;
}

interface Application {
  id: number; tournament_id: number | null; tournament_title: string;
  fio: string; age: string; fsr_id: string; coach: string; country_city: string;
  school: string; email: string; phone: string; status: string; notes: string; created_at: string;
}

interface AwardKit {
  id: number; title: string; description: string; composition: string[];
  price: number | null; icon: string; photo_url: string | null;
  sort_order: number; is_active: boolean; created_at: string;
}

interface AwardOrder {
  id: number; customer_name: string; customer_phone: string; customer_email: string | null;
  items: { kit_id: string; kit_title: string; tournament_id: number | null; tournament_title: string; price: number | null }[];
  total_price: number | null; status: string; notes: string | null; created_at: string;
}

const EMPTY_T_FORM = { title: '', description: '', date: '', location: '', age_category: '', price: '', fsr_id: '' };
const EMPTY_KIT_FORM = { title: '', description: '', composition: '', price: '', icon: 'award', photo_url: '', sort_order: '0', is_active: true };
const STATUS_LABELS: Record<string, string> = { new: 'Новая', pending_payment: 'Ждёт оплаты', confirmed: 'Подтверждена', paid: 'Оплачена', cancelled: 'Отменена' };
const STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', pending_payment: 'bg-orange-100 text-orange-700', confirmed: 'bg-green-100 text-green-700', paid: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };
const ORDER_STATUS_LABELS: Record<string, string> = { new: 'Новый', processing: 'В работе', done: 'Выполнен', cancelled: 'Отменён' };
const ORDER_STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', processing: 'bg-yellow-100 text-yellow-700', done: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const ICON_OPTIONS = ['award', 'trophy', 'medal', 'star', 'gift', 'crown'];
const RESULTS_URL = 'https://functions.poehali.dev/63f1c6fa-4f4f-4834-94be-73b844b9d51a';

interface TournamentResult {
  id: number; number: number | null; date: string | null; title: string;
  fsr_rating: string | null; protocol_url: string | null; regulation_url: string | null;
}
const EMPTY_TR_FORM = { number: '', date: '', title: '', fsr_rating: '', protocol_url: '', regulation_url: '' };

type Section = 'tournaments' | 'applications' | 'awards' | 'award-orders' | 'results';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState<Section>('tournaments');

  // Турниры
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tForm, setTForm] = useState(EMPTY_T_FORM);
  const [tLoading, setTLoading] = useState(false);
  const [tSaving, setTSaving] = useState(false);
  const [tShowForm, setTShowForm] = useState(false);
  const [tError, setTError] = useState('');
  const [tEditId, setTEditId] = useState<number | null>(null);

  // Заявки
  const [apps, setApps] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filterTournament, setFilterTournament] = useState('');

  // Каталог наград
  const [awardKits, setAwardKits] = useState<AwardKit[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [kitForm, setKitForm] = useState(EMPTY_KIT_FORM);
  const [editKit, setEditKit] = useState<AwardKit | null>(null);
  const [kitSaving, setKitSaving] = useState(false);
  const [showKitForm, setShowKitForm] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [kitError, setKitError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Заказы наград
  const [awardOrders, setAwardOrders] = useState<AwardOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Результаты турниров
  const [trResults, setTrResults] = useState<TournamentResult[]>([]);
  const [trLoading, setTrLoading] = useState(false);
  const [trForm, setTrForm] = useState(EMPTY_TR_FORM);
  const [trShowForm, setTrShowForm] = useState(false);
  const [trSaving, setTrSaving] = useState(false);
  const [trError, setTrError] = useState('');
  const [trEdit, setTrEdit] = useState<TournamentResult | null>(null);
  const [trUploading, setTrUploading] = useState<string | null>(null);
  const trProtocolRef = useRef<HTMLInputElement>(null);
  const trRegulationRef = useRef<HTMLInputElement>(null);
  const trEditProtocolRef = useRef<HTMLInputElement>(null);
  const trEditRegulationRef = useRef<HTMLInputElement>(null);

  // Подраздел внутри awards
  const [awardsTab, setAwardsTab] = useState<'kits' | 'tournaments'>('kits');
  const [awardsKitTournaments, setAwardsKitTournaments] = useState<Tournament[]>([]);
  const [aKitTLoading, setAKitTLoading] = useState(false);
  const [aKitTForm, setAKitTForm] = useState({ title: '', date: '' });
  const [aKitTShowForm, setAKitTShowForm] = useState(false);
  const [aKitTSaving, setAKitTSaving] = useState(false);
  const [aKitTError, setAKitTError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_password');
    if (saved) { setPassword(saved); loginWith(saved); }
  }, []);

  async function loginWith(pwd: string) {
    setTLoading(true);
    const res = await fetch(TOURNAMENTS_URL, { headers: { 'X-Admin-Password': pwd } });
    if (res.status === 401) {
      setAuthError('Неверный пароль'); setAuthed(false);
      sessionStorage.removeItem('admin_password'); setTLoading(false); return;
    }
    const data = await res.json();
    setTournaments(data.tournaments || []);
    setAuthed(true); setAuthError(''); setTLoading(false);
    sessionStorage.setItem('admin_password', pwd);
  }

  async function fetchTournaments() {
    setTLoading(true);
    const res = await fetch(TOURNAMENTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setTournaments(data.tournaments || []);
    setTLoading(false);
  }

  async function fetchApps() {
    setAppsLoading(true);
    const url = filterTournament ? `${APPS_URL}?tournament_id=${filterTournament}` : APPS_URL;
    const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setApps(data.applications || []);
    setAppsLoading(false);
  }

  async function fetchAwardKits() {
    setAwardsLoading(true);
    const res = await fetch(AWARD_CATALOG_ADMIN_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardKits(data.items || []);
    setAwardsLoading(false);
  }

  async function fetchAwardOrders() {
    setOrdersLoading(true);
    const res = await fetch(AWARD_ORDERS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardOrders(data.orders || []);
    setOrdersLoading(false);
  }

  async function fetchAwardKitTournaments() {
    setAKitTLoading(true);
    const res = await fetch(AWARD_TOURNAMENTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardsKitTournaments(data.tournaments || []);
    setAKitTLoading(false);
  }

  async function handleCreateAwardTournament(e: React.FormEvent) {
    e.preventDefault();
    setAKitTSaving(true); setAKitTError('');
    const res = await fetch(AWARD_TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ title: aKitTForm.title, date: aKitTForm.date || null }),
    });
    if (res.ok) { setAKitTForm({ title: '', date: '' }); setAKitTShowForm(false); fetchAwardKitTournaments(); }
    else setAKitTError('Ошибка при сохранении');
    setAKitTSaving(false);
  }

  async function handleDeleteAwardTournament(id: number) {
    if (!confirm('Удалить турнир из списка?')) return;
    await fetch(AWARD_TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchAwardKitTournaments();
  }

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

  async function fetchTrResults() {
    setTrLoading(true);
    const res = await fetch(RESULTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setTrResults(data.tournaments || []);
    setTrLoading(false);
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

  useEffect(() => {
    if (authed) fetchApps();
  }, [authed, filterTournament]);

  useEffect(() => {
    if (authed && section === 'applications') fetchApps();
    if (authed && section === 'awards') { fetchAwardKits(); fetchAwardKitTournaments(); }
    if (authed && section === 'award-orders') fetchAwardOrders();
    if (authed && section === 'results') fetchTrResults();
  }, [section]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    await loginWith(password);
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
    if (res.ok) { setTForm(EMPTY_T_FORM); setTShowForm(false); setTEditId(null); fetchTournaments(); }
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
      fsr_id: t.fsr_id || '',
    });
    setTError('');
    setTShowForm(true);
  }

  function handleCancelTournamentForm() {
    setTShowForm(false);
    setTEditId(null);
    setTForm(EMPTY_T_FORM);
    setTError('');
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

  async function handleToggleStatus(t: Tournament) {
    const newStatus = t.status === 'open' ? 'closed' : 'open';
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_status', id: t.id, status: newStatus }),
    });
    fetchTournaments();
  }

  async function handleSaveApp(e: React.FormEvent) {
    e.preventDefault();
    if (!editApp) return;
    setEditSaving(true);
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ ...editApp, _action: 'update' }),
    });
    setEditSaving(false);
    setEditApp(null);
    fetchApps();
  }

  async function handleDeleteApp(id: number) {
    if (!confirm('Удалить заявку?')) return;
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchApps();
  }

  // --- Каталог наград ---
  async function uploadPhoto(file: File, kitId?: number): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(',')[1];
        const res = await fetch(AWARD_CATALOG_ADMIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
          body: JSON.stringify({ _action: 'upload_photo', id: kitId, photo_b64: b64, content_type: file.type }),
        });
        const data = await res.json();
        resolve(data.photo_url || null);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleCreateKit(e: React.FormEvent) {
    e.preventDefault();
    setKitSaving(true); setKitError('');
    const composition = kitForm.composition.split('\n').map(s => s.trim()).filter(Boolean);
    const res = await fetch(AWARD_CATALOG_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        _action: 'create',
        title: kitForm.title, description: kitForm.description,
        composition, price: kitForm.price ? parseFloat(kitForm.price) : null,
        icon: kitForm.icon, photo_url: kitForm.photo_url || null,
        sort_order: parseInt(kitForm.sort_order) || 0,
        is_active: kitForm.is_active,
      }),
    });
    const data = await res.json();
    if (data.success) {
      // Загружаем фото если выбрано
      const file = photoInputRef.current?.files?.[0];
      if (file && data.id) {
        setUploadingPhoto(true);
        await uploadPhoto(file, data.id);
        setUploadingPhoto(false);
      }
      setKitForm(EMPTY_KIT_FORM);
      setShowKitForm(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
      fetchAwardKits();
    } else {
      setKitError(data.error || 'Ошибка сохранения');
    }
    setKitSaving(false);
  }

  async function handleUpdateKit(e: React.FormEvent) {
    e.preventDefault();
    if (!editKit) return;
    setKitSaving(true); setKitError('');

    let photoUrl = editKit.photo_url;
    const file = editPhotoInputRef.current?.files?.[0];
    if (file) {
      setUploadingPhoto(true);
      photoUrl = await uploadPhoto(file, editKit.id);
      setUploadingPhoto(false);
    }

    await fetch(AWARD_CATALOG_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        _action: 'update', id: editKit.id,
        title: editKit.title, description: editKit.description,
        composition: editKit.composition,
        price: editKit.price, icon: editKit.icon,
        photo_url: photoUrl,
        sort_order: editKit.sort_order, is_active: editKit.is_active,
      }),
    });
    setKitSaving(false);
    setEditKit(null);
    if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
    fetchAwardKits();
  }

  async function handleDeleteKit(id: number) {
    if (!confirm('Удалить комплект?')) return;
    await fetch(AWARD_CATALOG_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchAwardKits();
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Icon name="ShieldCheck" size={24} className="text-primary" />
            <h1 className="text-xl font-bold text-primary">Вход в админку</h1>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="pwd">Пароль</Label>
              <Input id="pwd" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Введите пароль" className="mt-1" required />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <Button type="submit" className="w-full">Войти</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Crown" size={20} />
          <span className="font-bold text-lg">Мир шахмат — Админка</span>
        </div>
        <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
          onClick={() => { sessionStorage.removeItem('admin_password'); setAuthed(false); setPassword(''); }}>
          <Icon name="LogOut" size={16} className="mr-1" /> Выйти
        </Button>
      </header>

      {/* Nav tabs */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex gap-1 min-w-max">
          {([
            ['tournaments', 'Swords', 'Турниры'],
            ['applications', 'ClipboardList', 'Заявки'],
            ['awards', 'Award', 'Каталог наград'],
            ['award-orders', 'ShoppingCart', 'Заказы наград'],
            ['results', 'ListChecks', 'Результаты'],
          ] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${section === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon name={icon} size={16} />{label}
              {key === 'applications' && apps.length > 0 && (
                <span className="ml-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5">{apps.length}</span>
              )}
              {key === 'award-orders' && awardOrders.length > 0 && (
                <span className="ml-1 bg-secondary text-secondary-foreground text-xs rounded-full px-1.5 py-0.5">{awardOrders.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* === ТУРНИРЫ === */}
        {section === 'tournaments' && (
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
                <div><Label>ID ФШР</Label><Input className="mt-1" value={tForm.fsr_id} onChange={e => setTForm({ ...tForm, fsr_id: e.target.value })} /></div>
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
        )}

        {/* === ЗАЯВКИ === */}
        {section === 'applications' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="ClipboardList" size={22} /> Заявки
              </h2>
              <select value={filterTournament} onChange={e => setFilterTournament(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Все турниры</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            {appsLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
              : apps.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Icon name="ClipboardList" size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Заявок пока нет</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {apps.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-base text-primary">{a.fio}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
                        </div>
                        <p className="text-sm text-secondary font-medium mb-2">{a.tournament_title}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-500">
                          {a.age && <span><b>Возраст:</b> {a.age}</span>}
                          {a.fsr_id && <span><b>ФШР:</b> {a.fsr_id}</span>}
                          {a.coach && <span><b>Тренер:</b> {a.coach}</span>}
                          {a.country_city && <span><b>Город:</b> {a.country_city}</span>}
                          {a.school && <span><b>Учебное зав.:</b> {a.school}</span>}
                          {a.email && <span><b>Email:</b> {a.email}</span>}
                          {a.phone && <span><b>Тел.:</b> {a.phone}</span>}
                        </div>
                        {a.notes && <p className="mt-2 text-sm text-gray-500 italic">💬 {a.notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setEditApp({ ...a })}>
                          <Icon name="Pencil" size={14} className="mr-1" /> Изменить
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteApp(a.id)}>
                          <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}

        {/* === КАТАЛОГ НАГРАД === */}
        {section === 'awards' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="Award" size={22} /> Каталог наград
              </h2>
              {awardsTab === 'kits' && (
                <Button onClick={() => { setShowKitForm(!showKitForm); setKitError(''); }}>
                  <Icon name={showKitForm ? 'X' : 'Plus'} size={16} className="mr-1" />
                  {showKitForm ? 'Отмена' : 'Добавить комплект'}
                </Button>
              )}
              {awardsTab === 'tournaments' && (
                <Button onClick={() => { setAKitTShowForm(!aKitTShowForm); setAKitTError(''); }}>
                  <Icon name={aKitTShowForm ? 'X' : 'Plus'} size={16} className="mr-1" />
                  {aKitTShowForm ? 'Отмена' : 'Добавить турнир'}
                </Button>
              )}
            </div>

            {/* Вкладки внутри наград */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {([['kits', 'LayoutGrid', 'Комплекты'], ['tournaments', 'Trophy', 'Турниры']] as const).map(([key, icon, label]) => (
                <button key={key} onClick={() => setAwardsTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${awardsTab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Icon name={icon} size={15} />{label}
                </button>
              ))}
            </div>

            {awardsTab === 'kits' && showKitForm && (
              <form onSubmit={handleCreateKit} className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Название *</Label>
                  <Input className="mt-1" value={kitForm.title} onChange={e => setKitForm({ ...kitForm, title: e.target.value })} required placeholder="Например: Стандарт" />
                </div>
                <div className="md:col-span-2">
                  <Label>Описание</Label>
                  <Input className="mt-1" value={kitForm.description} onChange={e => setKitForm({ ...kitForm, description: e.target.value })} placeholder="Краткое описание комплекта" />
                </div>
                <div className="md:col-span-2">
                  <Label>Состав (каждый пункт с новой строки)</Label>
                  <Textarea className="mt-1" rows={4} value={kitForm.composition}
                    onChange={e => setKitForm({ ...kitForm, composition: e.target.value })}
                    placeholder={"Медаль 1 место — 1 шт.\nМедаль 2 место — 1 шт.\nМедаль 3 место — 1 шт."} />
                </div>
                <div>
                  <Label>Цена (₽), оставьте пустым = «По запросу»</Label>
                  <Input type="number" className="mt-1" value={kitForm.price} onChange={e => setKitForm({ ...kitForm, price: e.target.value })} placeholder="1500" />
                </div>
                <div>
                  <Label>Иконка</Label>
                  <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={kitForm.icon} onChange={e => setKitForm({ ...kitForm, icon: e.target.value })}>
                    {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Порядок сортировки</Label>
                  <Input type="number" className="mt-1" value={kitForm.sort_order} onChange={e => setKitForm({ ...kitForm, sort_order: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="kit_active" checked={kitForm.is_active} onChange={e => setKitForm({ ...kitForm, is_active: e.target.checked })} className="w-4 h-4" />
                  <Label htmlFor="kit_active">Показывать на сайте</Label>
                </div>
                <div className="md:col-span-2">
                  <Label>Фото комплекта</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <input ref={photoInputRef} type="file" accept="image/*" className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" />
                  </div>
                </div>
                {kitError && <p className="md:col-span-2 text-red-500 text-sm">{kitError}</p>}
                <div className="md:col-span-2 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowKitForm(false)}>Отмена</Button>
                  <Button type="submit" disabled={kitSaving || uploadingPhoto}>
                    {uploadingPhoto ? 'Загрузка фото...' : kitSaving ? 'Сохранение...' : 'Создать комплект'}
                  </Button>
                </div>
              </form>
            )}

            {awardsTab === 'kits' && (awardsLoading ? (
              <div className="text-center py-12 text-gray-400">Загрузка...</div>
            ) : awardKits.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Icon name="Award" size={40} className="mx-auto mb-3 opacity-30" />
                <p>Комплектов пока нет. Добавьте первый!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {awardKits.map(kit => (
                  <div key={kit.id} className={`bg-white rounded-2xl shadow overflow-hidden flex flex-col ${!kit.is_active ? 'opacity-60' : ''}`}>
                    {kit.photo_url ? (
                      <img src={kit.photo_url} alt={kit.title} className="w-full object-contain bg-gray-50" />
                    ) : (
                      <div className="w-full h-72 bg-gray-100 flex items-center justify-center">
                        <Icon name="Image" size={32} className="text-gray-300" />
                      </div>
                    )}
                    <div className="p-4 flex flex-col flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-primary">{kit.title}</h3>
                        {!kit.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Скрыт</span>}
                      </div>
                      {kit.description && <p className="text-sm text-gray-500 mb-2">{kit.description}</p>}
                      {kit.composition.length > 0 && (
                        <ul className="text-xs text-gray-500 space-y-0.5 mb-3">
                          {kit.composition.map((c, i) => <li key={i}>• {c}</li>)}
                        </ul>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="font-bold text-primary">
                          {kit.price != null ? `${kit.price.toLocaleString('ru')} ₽` : 'По запросу'}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditKit({ ...kit })}>
                            <Icon name="Pencil" size={13} />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteKit(kit.id)}>
                            <Icon name="Trash2" size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Вкладка турниров */}
            {awardsTab === 'tournaments' && (
              <>
                {aKitTShowForm && (
                  <form onSubmit={handleCreateAwardTournament} className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label>Название турнира *</Label>
                      <Input className="mt-1" value={aKitTForm.title} onChange={e => setAKitTForm({ ...aKitTForm, title: e.target.value })} required placeholder="Например: Первенство города 2025" />
                    </div>
                    <div>
                      <Label>Дата</Label>
                      <Input type="date" className="mt-1" value={aKitTForm.date} onChange={e => setAKitTForm({ ...aKitTForm, date: e.target.value })} />
                    </div>
                    {aKitTError && <p className="md:col-span-2 text-red-500 text-sm">{aKitTError}</p>}
                    <div className="md:col-span-2 flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setAKitTShowForm(false)}>Отмена</Button>
                      <Button type="submit" disabled={aKitTSaving}>{aKitTSaving ? 'Сохранение...' : 'Добавить'}</Button>
                    </div>
                  </form>
                )}
                {aKitTLoading ? (
                  <div className="text-center py-12 text-gray-400">Загрузка...</div>
                ) : awardsKitTournaments.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Icon name="Trophy" size={40} className="mx-auto mb-3 opacity-30" />
                    <p>Турниров пока нет. Добавьте первый!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {awardsKitTournaments.map(t => (
                      <div key={t.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-primary">{t.title}</p>
                          {t.date && <p className="text-sm text-gray-400">{new Date(t.date).toLocaleDateString('ru-RU')}</p>}
                        </div>
                        <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 shrink-0" onClick={() => handleDeleteAwardTournament(t.id)}>
                          <Icon name="Trash2" size={13} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === ЗАКАЗЫ НАГРАД === */}
        {section === 'award-orders' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="ShoppingCart" size={22} /> Заказы наград
              </h2>
              <Button variant="outline" size="sm" onClick={fetchAwardOrders}>
                <Icon name="RefreshCw" size={14} className="mr-1" /> Обновить
              </Button>
            </div>
            {ordersLoading ? (
              <div className="text-center py-12 text-gray-400">Загрузка...</div>
            ) : awardOrders.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Icon name="ShoppingCart" size={40} className="mx-auto mb-3 opacity-30" />
                <p>Заказов пока нет</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {awardOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl shadow p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary">#{order.id} — {order.customer_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 flex gap-3 flex-wrap">
                          <span>{order.customer_phone}</span>
                          {order.customer_email && <span>{order.customer_email}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-lg text-primary">
                          {order.total_price ? `${order.total_price.toLocaleString('ru')} ₽` : 'По запросу'}
                        </div>
                        <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('ru-RU')}</div>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Позиции заказа</p>
                      <div className="flex flex-col gap-1.5">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">
                              <b>{item.kit_title}</b>
                              <span className="text-gray-400"> — {item.tournament_title}</span>
                            </span>
                            <span className="text-gray-500 shrink-0 ml-2">
                              {item.price ? `${item.price.toLocaleString('ru')} ₽` : 'По запросу'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.notes && <p className="mt-2 text-sm text-gray-500 italic">💬 {order.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === РЕЗУЛЬТАТЫ ТУРНИРОВ === */}
        {section === 'results' && (
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
          </>
        )}

      </div>

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

      {/* Модал редактирования заявки */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование заявки</h2>
              <button onClick={() => setEditApp(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSaveApp} className="flex flex-col gap-3">
              <div><Label>ФИО участника</Label><Input className="mt-1" value={editApp.fio} onChange={e => setEditApp({ ...editApp, fio: e.target.value })} /></div>
              <div><Label>Возраст</Label><Input className="mt-1" value={editApp.age} onChange={e => setEditApp({ ...editApp, age: e.target.value })} /></div>
              <div><Label>ID ФШР</Label><Input className="mt-1" value={editApp.fsr_id} onChange={e => setEditApp({ ...editApp, fsr_id: e.target.value })} /></div>
              <div><Label>ФИО тренера</Label><Input className="mt-1" value={editApp.coach} onChange={e => setEditApp({ ...editApp, coach: e.target.value })} /></div>
              <div><Label>Страна / Город</Label><Input className="mt-1" value={editApp.country_city} onChange={e => setEditApp({ ...editApp, country_city: e.target.value })} /></div>
              <div><Label>Учебное заведение</Label><Input className="mt-1" value={editApp.school} onChange={e => setEditApp({ ...editApp, school: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" className="mt-1" value={editApp.email} onChange={e => setEditApp({ ...editApp, email: e.target.value })} /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={editApp.phone} onChange={e => setEditApp({ ...editApp, phone: e.target.value })} /></div>
              <div>
                <Label>Статус</Label>
                <select value={editApp.status} onChange={e => setEditApp({ ...editApp, status: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="new">Новая</option>
                  <option value="pending_payment">Ждёт оплаты</option>
                  <option value="confirmed">Подтверждена</option>
                  <option value="paid">Оплачена</option>
                  <option value="cancelled">Отменена</option>
                </select>
              </div>
              <div><Label>Заметки</Label><Textarea className="mt-1" rows={3} value={editApp.notes || ''} onChange={e => setEditApp({ ...editApp, notes: e.target.value })} placeholder="Внутренние заметки..." /></div>
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setEditApp(null)}>Отмена</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал редактирования комплекта */}
      {editKit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditKit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование комплекта</h2>
              <button onClick={() => setEditKit(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleUpdateKit} className="flex flex-col gap-3">
              <div><Label>Название *</Label><Input className="mt-1" value={editKit.title} onChange={e => setEditKit({ ...editKit, title: e.target.value })} required /></div>
              <div><Label>Описание</Label><Input className="mt-1" value={editKit.description || ''} onChange={e => setEditKit({ ...editKit, description: e.target.value })} /></div>
              <div>
                <Label>Состав (каждый пункт с новой строки)</Label>
                <Textarea className="mt-1" rows={4}
                  value={editKit.composition.join('\n')}
                  onChange={e => setEditKit({ ...editKit, composition: e.target.value.split('\n') })} />
              </div>
              <div><Label>Цена (₽)</Label><Input type="number" className="mt-1" value={editKit.price ?? ''} onChange={e => setEditKit({ ...editKit, price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div>
                <Label>Иконка</Label>
                <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={editKit.icon} onChange={e => setEditKit({ ...editKit, icon: e.target.value })}>
                  {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div><Label>Порядок сортировки</Label><Input type="number" className="mt-1" value={editKit.sort_order} onChange={e => setEditKit({ ...editKit, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit_kit_active" checked={editKit.is_active} onChange={e => setEditKit({ ...editKit, is_active: e.target.checked })} className="w-4 h-4" />
                <Label htmlFor="edit_kit_active">Показывать на сайте</Label>
              </div>
              <div>
                <Label>Фото</Label>
                {editKit.photo_url && (
                  <img src={editKit.photo_url} alt="текущее фото" className="mt-2 w-full h-36 object-cover rounded-lg mb-2" />
                )}
                <input ref={editPhotoInputRef} type="file" accept="image/*" className="mt-1 text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer w-full" />
              </div>
              {kitError && <p className="text-red-500 text-sm">{kitError}</p>}
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setEditKit(null)}>Отмена</Button>
                <Button type="submit" disabled={kitSaving || uploadingPhoto}>
                  {uploadingPhoto ? 'Загрузка фото...' : kitSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
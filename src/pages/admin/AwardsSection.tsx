import { Dispatch, SetStateAction, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  Tournament, AwardKit, AwardOrder, AWARD_CATALOG_ADMIN_URL, AWARD_TOURNAMENTS_URL, AWARD_ORDERS_URL,
  EMPTY_KIT_FORM, ICON_OPTIONS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from './adminTypes';

interface AwardsSectionProps {
  password: string;
  awardKits: AwardKit[];
  awardsLoading: boolean;
  kitForm: typeof EMPTY_KIT_FORM;
  setKitForm: Dispatch<SetStateAction<typeof EMPTY_KIT_FORM>>;
  editKit: AwardKit | null;
  setEditKit: Dispatch<SetStateAction<AwardKit | null>>;
  kitSaving: boolean;
  setKitSaving: Dispatch<SetStateAction<boolean>>;
  showKitForm: boolean;
  setShowKitForm: Dispatch<SetStateAction<boolean>>;
  uploadingPhoto: boolean;
  setUploadingPhoto: Dispatch<SetStateAction<boolean>>;
  kitError: string;
  setKitError: Dispatch<SetStateAction<string>>;
  photoInputRef: RefObject<HTMLInputElement>;
  editPhotoInputRef: RefObject<HTMLInputElement>;
  fetchAwardKits: () => Promise<void>;
  awardsTab: 'kits' | 'tournaments';
  setAwardsTab: Dispatch<SetStateAction<'kits' | 'tournaments'>>;
  awardsKitTournaments: Tournament[];
  aKitTLoading: boolean;
  aKitTForm: { title: string; date: string };
  setAKitTForm: Dispatch<SetStateAction<{ title: string; date: string }>>;
  aKitTShowForm: boolean;
  setAKitTShowForm: Dispatch<SetStateAction<boolean>>;
  aKitTSaving: boolean;
  setAKitTSaving: Dispatch<SetStateAction<boolean>>;
  aKitTError: string;
  setAKitTError: Dispatch<SetStateAction<string>>;
  fetchAwardKitTournaments: () => Promise<void>;
}

export default function AwardsSection({
  password, awardKits, awardsLoading, kitForm, setKitForm, editKit, setEditKit,
  kitSaving, setKitSaving, showKitForm, setShowKitForm, uploadingPhoto, setUploadingPhoto,
  kitError, setKitError, photoInputRef, editPhotoInputRef, fetchAwardKits,
  awardsTab, setAwardsTab, awardsKitTournaments, aKitTLoading, aKitTForm, setAKitTForm,
  aKitTShowForm, setAKitTShowForm, aKitTSaving, setAKitTSaving, aKitTError, setAKitTError,
  fetchAwardKitTournaments,
}: AwardsSectionProps) {
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

  return (
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
    </>
  );
}

interface AwardOrdersSectionProps {
  password: string;
  awardOrders: AwardOrder[];
  ordersLoading: boolean;
  fetchAwardOrders: () => Promise<void>;
}

export function AwardOrdersSection({ password, awardOrders, ordersLoading, fetchAwardOrders }: AwardOrdersSectionProps) {
  async function handleDeleteOrder(id: number) {
    if (!confirm('Удалить заказ?')) return;
    await fetch(AWARD_ORDERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchAwardOrders();
  }

  return (
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
                  <button onClick={() => handleDeleteOrder(order.id)} className="text-red-500 hover:text-red-700 mt-1 inline-flex items-center gap-1 text-xs">
                    <Icon name="Trash2" size={13} /> Удалить
                  </button>
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
  );
}
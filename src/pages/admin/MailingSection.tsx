import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { MailingContact, MailingCampaign, MAILING_URL } from './adminTypes';

interface MailingSectionProps {
  password: string;
  contacts: MailingContact[];
  campaigns: MailingCampaign[];
  loading: boolean;
  fetchMailing: () => Promise<void>;
}

export default function MailingSection({ password, contacts, campaigns, loading, fetchMailing }: MailingSectionProps) {
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ email: '', name: '', organization: '', role: '' });
  const [addingContact, setAddingContact] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importing, setImporting] = useState(false);

  const [showSend, setShowSend] = useState(false);
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAddingContact(true);
    const res = await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'add_contact', ...newContact }),
    });
    setAddingContact(false);
    if (res.ok) {
      toast.success('Адрес добавлен');
      setNewContact({ email: '', name: '', organization: '', role: '' });
      setShowAddContact(false);
      fetchMailing();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Не удалось добавить адрес');
    }
  }

  async function handleDeleteContact(id: number) {
    if (!confirm('Удалить адрес из базы?')) return;
    await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete_contact', id }),
    });
    fetchMailing();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    const res = await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'import_contacts', raw: importRaw }),
    });
    setImporting(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Добавлено новых адресов: ${data.added}`);
      setImportRaw('');
      setShowImport(false);
      fetchMailing();
    } else {
      toast.error('Не удалось импортировать список');
    }
  }

  async function handleSendCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Отправить письмо на ${contacts.length} адресов?`)) return;
    setSending(true);
    const res = await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'send_campaign', subject, body: emailBody }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Отправлено: ${data.sent_count}, ошибок: ${data.failed_count}`);
      setSubject('');
      setEmailBody('');
      setShowSend(false);
      fetchMailing();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Не удалось отправить рассылку');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Mail" size={22} /> Рассылки
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => fetchMailing()} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Icon name="Upload" size={14} className="mr-1" /> Импорт списком
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddContact(true)}>
            <Icon name="Plus" size={14} className="mr-1" /> Добавить адрес
          </Button>
          <Button size="sm" onClick={() => setShowSend(true)} disabled={contacts.length === 0}>
            <Icon name="Send" size={14} className="mr-1" /> Новая рассылка
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        База email-адресов тренеров и руководителей учреждений дополнительного образования. Письма отправляются через Unisender.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="Mail" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Адресов пока нет. Добавьте первый!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-between">
            <span>База адресов</span>
            <span>{contacts.length} шт.</span>
          </div>
          <div className="divide-y divide-gray-50">
            {contacts.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{c.email}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[c.name, c.organization, c.role].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 shrink-0" onClick={() => handleDeleteContact(c.id)}>
                  <Icon name="Trash2" size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            История рассылок
          </div>
          <div className="divide-y divide-gray-50">
            {campaigns.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{c.subject}</p>
                  <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString('ru-RU')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Отправлено: {c.sent_count}</span>
                  {c.failed_count > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Ошибок: {c.failed_count}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модал добавления адреса */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowAddContact(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Добавить адрес</h2>
              <button onClick={() => setShowAddContact(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleAddContact} className="flex flex-col gap-3">
              <div><Label>Email *</Label><Input type="email" required className="mt-1" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} /></div>
              <div><Label>Имя</Label><Input className="mt-1" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} /></div>
              <div><Label>Учреждение</Label><Input className="mt-1" value={newContact.organization} onChange={e => setNewContact({ ...newContact, organization: e.target.value })} /></div>
              <div><Label>Должность</Label><Input className="mt-1" placeholder="Тренер / Руководитель" value={newContact.role} onChange={e => setNewContact({ ...newContact, role: e.target.value })} /></div>
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddContact(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={addingContact}>{addingContact ? 'Добавление...' : 'Добавить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал импорта списком */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Импорт списка адресов</h2>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleImport} className="flex flex-col gap-3">
              <Label>Адреса через запятую или с новой строки</Label>
              <Textarea rows={6} required value={importRaw} onChange={e => setImportRaw(e.target.value)} placeholder={'email1@mail.ru\nemail2@mail.ru'} />
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowImport(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={importing}>{importing ? 'Импорт...' : 'Импортировать'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал новой рассылки */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowSend(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Новая рассылка</h2>
              <button onClick={() => setShowSend(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSendCampaign} className="flex flex-col gap-3">
              <div><Label>Тема письма *</Label><Input required className="mt-1" value={subject} onChange={e => setSubject(e.target.value)} /></div>
              <div>
                <Label>Текст письма (HTML) *</Label>
                <Textarea rows={10} required className="mt-1 font-mono text-xs" value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Вставьте HTML-код письма или обычный текст" />
                <p className="text-xs text-gray-400 mt-1">Можно вставить готовый HTML-шаблон письма</p>
              </div>
              <p className="text-sm text-gray-500">Будет отправлено на {contacts.length} адресов</p>
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSend(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={sending}>{sending ? 'Отправка...' : 'Отправить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

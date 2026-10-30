import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import func2url from '../../../backend/func2url.json';

const URL_ = func2url['mailing'];

interface Template { id: number; name: string; subject: string }
interface Contact { id: number; email: string; name: string; organization: string }
interface Campaign { id: number; subject: string; sent: number; failed: number; created_at: string }

export default function MailingSection({ password }: { password: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [html, setHtml] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);

  const hdr = { 'Content-Type': 'application/json', 'X-Admin-Password': password };

  async function load() {
    const [t, c, k] = await Promise.all([
      fetch(`${URL_}?what=templates`, { headers: hdr }).then(r => r.json()),
      fetch(`${URL_}?what=contacts`, { headers: hdr }).then(r => r.json()),
      fetch(`${URL_}?what=campaigns`, { headers: hdr }).then(r => r.json()),
    ]);
    setTemplates(t.templates || []);
    setContacts(c.contacts || []);
    setCampaigns(k.campaigns || []);
  }

  useEffect(() => { load(); }, []);

  async function openTemplate(id: number) {
    setSelected(id);
    setHtml('');
    const r = await fetch(`${URL_}?what=template&id=${id}`, { headers: hdr }).then(r => r.json());
    setHtml(r.html_body || '');
  }

  async function post(payload: Record<string, unknown>) {
    const r = await fetch(URL_, { method: 'POST', headers: hdr, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Ошибка');
    return d;
  }

  async function sendTest() {
    if (!selected) return;
    setBusy(true);
    try {
      await post({ _action: 'send_test', template_id: selected, email: testEmail });
      toast.success('Тестовое письмо отправлено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка отправки');
    }
    setBusy(false);
  }

  async function sendAll() {
    if (!selected) return;
    if (!confirm(`Отправить письмо ${contacts.length} получателям?`)) return;
    setBusy(true);
    try {
      const d = await post({ _action: 'send', template_id: selected });
      toast.success(`Отправлено: ${d.sent}, ошибок: ${d.failed}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка отправки');
    }
    setBusy(false);
  }

  async function addContacts() {
    setBusy(true);
    try {
      const d = await post({ _action: 'add_contacts', text: importText });
      toast.success(`Добавлено контактов: ${d.added}`);
      setImportText('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setBusy(false);
  }

  async function removeContact(id: number) {
    await post({ _action: 'delete_contact', id });
    setContacts(contacts.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-heading font-bold text-lg text-primary mb-3 flex items-center gap-2"><Icon name="FileText" size={18} /> Шаблоны писем</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {templates.map(t => (
            <button key={t.id} onClick={() => openTemplate(t.id)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${selected === t.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
              <p className="font-semibold text-sm text-primary">{t.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
              {html ? <iframe title="Предпросмотр письма" srcDoc={html} className="w-full h-[600px] bg-white" /> : <p className="p-6 text-sm text-gray-500">Загрузка...</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-primary flex items-center gap-2"><Icon name="Code" size={16} /> HTML письма</p>
                <Button type="button" variant="outline" size="sm" disabled={!html} onClick={() => { navigator.clipboard.writeText(html); toast.success('HTML скопирован'); }}>
                  <Icon name="Copy" size={14} className="mr-1.5" /> Копировать
                </Button>
              </div>
              <Textarea readOnly value={html} rows={10} className="font-mono text-xs" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input type="email" placeholder="Email для тестового письма" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              <Button onClick={sendTest} disabled={busy || !testEmail} variant="outline" className="shrink-0">Отправить тест</Button>
            </div>
            <Button onClick={sendAll} disabled={busy || contacts.length === 0} className="w-full">
              <Icon name="Send" size={16} className="mr-2" /> Отправить всем контактам ({contacts.length})
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-heading font-bold text-lg text-primary mb-3 flex items-center gap-2"><Icon name="Users" size={18} /> Контакты ({contacts.length})</h2>
        <Textarea rows={4} placeholder={'Каждый контакт с новой строки: email; имя; организация\nivanov@mail.ru; Иванов И.И.; ДДТ №1'} value={importText} onChange={e => setImportText(e.target.value)} />
        <Button onClick={addContacts} disabled={busy || !importText.trim()} className="mt-2">Добавить в список</Button>
        {contacts.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 max-h-72 overflow-y-auto text-sm">
            {contacts.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.email}</p>
                  <p className="text-xs text-gray-500 truncate">{[c.name, c.organization].filter(Boolean).join(' · ')}</p>
                </div>
                <button onClick={() => removeContact(c.id)} className="text-gray-400 hover:text-red-600 shrink-0"><Icon name="Trash2" size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {campaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-heading font-bold text-lg text-primary mb-3 flex items-center gap-2"><Icon name="History" size={18} /> История рассылок</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {campaigns.map(c => (
              <li key={c.id} className="py-2 flex justify-between gap-3">
                <span className="truncate">{c.subject}</span>
                <span className="text-gray-500 shrink-0">{c.created_at.slice(0, 16)} · отправлено {c.sent}{c.failed ? `, ошибок ${c.failed}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { MailingTemplate, MAILING_URL } from './adminTypes';

interface TemplatesSectionProps {
  password: string;
  templates: MailingTemplate[];
  loading: boolean;
  fetchMailing: () => Promise<void>;
}

const EMPTY_FORM = { id: null as number | null, name: '', subject: '', html_body: '' };

export default function TemplatesSection({ password, templates, loading, fetchMailing }: TemplatesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(t: MailingTemplate) {
    setForm({ id: t.id, name: t.name, subject: t.subject, html_body: t.html_body });
    setShowForm(true);
  }

  function handlePreview(html: string) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'save_template', ...form }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Шаблон сохранён');
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchMailing();
    } else {
      toast.error('Не удалось сохранить шаблон');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить шаблон письма?')) return;
    await fetch(MAILING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete_template', id }),
    });
    fetchMailing();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="FileText" size={22} /> Шаблоны писем
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchMailing()} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Icon name="Plus" size={14} className="mr-1" /> Новый шаблон
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Готовые HTML-письма для рассылок: приглашения на турниры, наградная документация и другие. Выбираются при создании рассылки в разделе «Рассылки».
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="FileText" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Шаблонов пока нет. Создайте первый!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-primary truncate">{t.name}</h3>
                <p className="text-sm text-gray-500 truncate">{t.subject}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handlePreview(t.html_body)}>
                  <Icon name="Eye" size={14} className="mr-1" /> Просмотр
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                  <Icon name="Pencil" size={14} className="mr-1" /> Изменить
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(t.id)}>
                  <Icon name="Trash2" size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модал создания/редактирования шаблона */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">{form.id ? 'Редактирование шаблона' : 'Новый шаблон'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div><Label>Название шаблона *</Label><Input required className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Например: Королевский блиц — обе лиги" /></div>
              <div><Label>Тема письма *</Label><Input required className="mt-1" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div>
                <Label>HTML письма *</Label>
                <Textarea rows={14} required className="mt-1 font-mono text-xs" value={form.html_body} onChange={e => setForm({ ...form, html_body: e.target.value })} placeholder="Вставьте готовый HTML-код письма" />
              </div>
              {form.html_body && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => handlePreview(form.html_body)}>
                  <Icon name="Eye" size={14} className="mr-1" /> Предпросмотр
                </Button>
              )}
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

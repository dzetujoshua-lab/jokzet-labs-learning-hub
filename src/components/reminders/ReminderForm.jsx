import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayISO } from '@/lib/programme';

const empty = () => ({ title: '', department_code: '', due_date: todayISO(), note: '' });

export default function ReminderForm({ open, onOpenChange, departments }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await base44.entities.Reminder.create({ ...form, title: form.title.trim(), status: 'open' });
    setSaving(false);
    setForm(empty());
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New reminder" description="Deadlines, submissions and reviews that must not slip.">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Reminder">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Submit week 3 evidence pack" autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Due date">
            <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </FormField>
          <FormField label="Department">
            <Select value={form.department_code} onValueChange={(v) => set('department_code', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.code} value={dept.code}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Note">
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} placeholder="What has to be ready" />
        </FormField>

        <Button type="submit" disabled={saving || !form.title.trim()} className="w-full">
          {saving ? 'Saving…' : 'Set reminder'}
        </Button>
      </form>
    </Modal>
  );
}
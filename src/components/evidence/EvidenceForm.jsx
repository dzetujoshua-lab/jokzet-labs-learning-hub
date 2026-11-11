import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EVIDENCE_TYPES, todayISO } from '@/lib/programme';

const empty = () => ({
  title: '',
  department_code: '',
  type: 'Screenshot',
  description: '',
  link_url: '',
  captured_date: todayISO(),
});

export default function EvidenceForm({ open, onOpenChange, departments }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department_code) return;
    setSaving(true);
    setError('');
    try {
      let uploaded = {};
      if (file) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploaded = { file_uri, file_name: file.name };
      }

      await base44.entities.Evidence.create({
        ...form,
        ...uploaded,
        title: form.title.trim(),
        status: 'logged',
      });

      setForm(empty());
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Could not save this evidence.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log evidence"
      description="Attach the proof: a screenshot, photo, code file, document, or a link to the work."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="What does this prove">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Login form shipped and responsive" autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Department">
            <Select value={form.department_code} onValueChange={(v) => set('department_code', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick one" />
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

          <FormField label="Type">
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Date">
          <Input type="date" value={form.captured_date} onChange={(e) => set('captured_date', e.target.value)} />
        </FormField>

        <FormField label="File (stored privately)">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-foreground"
          />
        </FormField>

        <FormField label="Or a link">
          <Input value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://github.com/…" />
        </FormField>

        <FormField label="Notes">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="What to look at, and why it matters" />
        </FormField>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" disabled={saving || !form.title.trim() || !form.department_code} className="w-full">
          {saving ? 'Uploading…' : 'Log evidence'}
        </Button>
      </form>
    </Modal>
  );
}
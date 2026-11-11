import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PIECE_STATUS, todayISO } from '@/lib/programme';

const empty = () => ({
  title: '',
  department_code: '',
  summary: '',
  tools: '',
  status: 'building',
  is_capstone: false,
  stage: 0,
  stages: 8,
  media_url: '',
  link_url: '',
  completed_date: todayISO(),
});

export default function PortfolioForm({ open, onOpenChange, departments, piece }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(piece ? { ...empty(), ...piece } : empty());
  }, [open, piece?.id]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      department_code: form.department_code,
      summary: form.summary,
      tools: form.tools,
      status: form.status,
      is_capstone: !!form.is_capstone,
      stage: Number(form.stage) || 0,
      stages: Number(form.stages) || 8,
      media_url: form.media_url,
      link_url: form.link_url,
      completed_date: form.status === 'shipped' ? form.completed_date : undefined,
    };
    if (piece) {
      await base44.entities.PortfolioPiece.update(piece.id, payload);
    } else {
      await base44.entities.PortfolioPiece.create(payload);
    }
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={piece ? 'Edit portfolio piece' : 'New portfolio piece'}
      description="Real work, shown the way a client or employer would see it."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Title">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="BusinessOS Ghana" autoFocus />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Lead department">
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
          <FormField label="Status">
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Summary">
          <Textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={3} placeholder="What it does, who it's for, what you built." />
        </FormField>

        <FormField label="Tools">
          <Input value={form.tools} onChange={(e) => set('tools', e.target.value)} placeholder="React · Figma · VPS · Postgres" />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Stage">
            <Input type="number" min="0" value={form.stage} onChange={(e) => set('stage', e.target.value)} />
          </FormField>
          <FormField label="Stages">
            <Input type="number" min="1" value={form.stages} onChange={(e) => set('stages', e.target.value)} />
          </FormField>
          <FormField label="Capstone">
            <Select value={form.is_capstone ? 'yes' : 'no'} onValueChange={(v) => set('is_capstone', v === 'yes')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Regular piece</SelectItem>
                <SelectItem value="yes">Main capstone</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Cover image URL">
            <Input value={form.media_url} onChange={(e) => set('media_url', e.target.value)} placeholder="https://…" />
          </FormField>
          <FormField label="Live link">
            <Input value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://…" />
          </FormField>
        </div>

        <Button type="submit" disabled={saving || !form.title.trim()} className="w-full">
          {saving ? 'Saving…' : piece ? 'Save changes' : 'Add piece'}
        </Button>
      </form>
    </Modal>
  );
}
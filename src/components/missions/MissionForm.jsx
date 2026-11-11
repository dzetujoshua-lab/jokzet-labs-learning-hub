import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MISSION_KINDS, EVIDENCE_TYPES, todayISO } from '@/lib/programme';

const empty = (departmentCode) => ({
  title: '',
  department_code: departmentCode || '',
  date: todayISO(),
  minutes: 45,
  kind: 'Build',
  evidence_type: 'Screenshot',
  xp_reward: 25,
  notes: '',
});

export default function MissionForm({ open, onOpenChange, departments, defaultDepartment }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => empty(defaultDepartment));
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department_code) return;
    setSaving(true);
    await base44.entities.Mission.create({
      ...form,
      title: form.title.trim(),
      minutes: Number(form.minutes) || 45,
      xp_reward: Number(form.xp_reward) || 25,
    });
    setSaving(false);
    setForm(empty(defaultDepartment));
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New mission"
      description="One practical, finishable action — with the evidence it should leave behind."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="What will you do">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Build the login form" autoFocus />
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

          <FormField label="Date">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Kind">
            <Select value={form.kind} onValueChange={(v) => set('kind', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSION_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Evidence to capture">
            <Select value={form.evidence_type} onValueChange={(v) => set('evidence_type', v)}>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Minutes">
            <Input type="number" min="5" step="5" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} />
          </FormField>
          <FormField label="XP reward">
            <Input type="number" min="5" step="5" value={form.xp_reward} onChange={(e) => set('xp_reward', e.target.value)} />
          </FormField>
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Constraints, links, what done looks like…" />
        </FormField>

        <Button type="submit" disabled={saving || !form.title.trim() || !form.department_code} className="w-full">
          {saving ? 'Saving…' : 'Add mission'}
        </Button>
      </form>
    </Modal>
  );
}
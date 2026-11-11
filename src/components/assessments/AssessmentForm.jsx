import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ASSESSMENT_TYPES, todayISO } from '@/lib/programme';

const empty = () => ({
  title: '',
  department_code: '',
  date: todayISO(),
  type: 'Practical',
  score: '',
  max_score: 100,
  outcome: 'pending',
  notes: '',
});

export default function AssessmentForm({ open, onOpenChange, departments }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.department_code) return;
    setSaving(true);
    await base44.entities.Assessment.create({
      ...form,
      title: form.title.trim(),
      score: form.score === '' ? undefined : Number(form.score),
      max_score: Number(form.max_score) || 100,
    });
    setSaving(false);
    setForm(empty());
    queryClient.invalidateQueries({ queryKey: ['assessments'] });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log an assessment"
      description="Practical tests, quizzes and reviews — the checkpoint between levels."
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Assessment">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Responsive layout practical" autoFocus />
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
                {ASSESSMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </FormField>
          <FormField label="Score">
            <Input type="number" min="0" value={form.score} onChange={(e) => set('score', e.target.value)} placeholder="—" />
          </FormField>
          <FormField label="Out of">
            <Input type="number" min="1" value={form.max_score} onChange={(e) => set('max_score', e.target.value)} />
          </FormField>
        </div>

        <FormField label="Outcome">
          <Select value={form.outcome} onValueChange={(v) => set('outcome', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="revise">Revise</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="What to fix next">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </FormField>

        <Button type="submit" disabled={saving || !form.title.trim() || !form.department_code} className="w-full">
          {saving ? 'Saving…' : 'Save assessment'}
        </Button>
      </form>
    </Modal>
  );
}
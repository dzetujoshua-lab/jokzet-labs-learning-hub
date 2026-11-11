import { useState } from 'react';
import moment from 'moment';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, BellRing, Check, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ReminderForm from '@/components/reminders/ReminderForm';
import { Button } from '@/components/ui/button';
import { useDepartments, useReminders } from '@/hooks/useProgramme';
import { isPast, metaFor, sortBy, todayISO } from '@/lib/programme';

export default function Reminders() {
  const queryClient = useQueryClient();
  const { data: reminders = [] } = useReminders();
  const { data: departments = [] } = useDepartments();
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reminders'] });

  const open = sortBy(reminders.filter((r) => r.status === 'open'), 'due_date', 'asc');
  const done = sortBy(reminders.filter((r) => r.status !== 'open'), 'due_date', 'desc');

  const groups = [
    { id: 'overdue', label: 'Overdue', items: open.filter((r) => isPast(r.due_date)) },
    { id: 'today', label: 'Due today', items: open.filter((r) => r.due_date === todayISO()) },
    { id: 'upcoming', label: 'Upcoming', items: open.filter((r) => !isPast(r.due_date) && r.due_date !== todayISO()) },
  ].filter((group) => group.items.length);

  const complete = async (reminder) => {
    await base44.entities.Reminder.update(reminder.id, { status: 'done' });
    refresh();
  };

  const remove = async (reminder) => {
    await base44.entities.Reminder.delete(reminder.id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reminders"
        title="Nothing slips"
        description="Submission windows, assessments and reviews — grouped by how close they are."
      >
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New reminder
        </Button>
      </PageHeader>

      {groups.length ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id} className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <p className={`mono-label ${group.id === 'overdue' ? 'text-destructive' : ''}`}>{group.label}</p>
                <span className="font-mono text-[10px] text-muted-foreground">{group.items.length}</span>
              </div>
              <ul>
                {group.items.map((reminder) => {
                  const meta = metaFor(reminder.department_code);
                  const dept = departments.find((d) => d.code === reminder.department_code);
                  return (
                    <li key={reminder.id} className="group flex items-start gap-3.5 border-b border-border/60 px-5 py-4 last:border-0">
                      <button
                        type="button"
                        onClick={() => complete(reminder)}
                        aria-label="Mark reminder done"
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors hover:border-primary hover:text-primary"
                      >
                        <Check className="h-3 w-3" strokeWidth={2.6} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-foreground">{reminder.title}</p>
                        {reminder.note ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reminder.note}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                          <span className={group.id === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}>
                            {moment(reminder.due_date).format('ddd D MMM')}
                          </span>
                          {dept ? <span style={{ color: meta.color }}>{dept.name}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(reminder)}
                        aria-label="Delete reminder"
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={BellRing} title="No open reminders" hint="Add the deadlines that matter — submissions, assessments, reviews.">
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New reminder
          </Button>
        </EmptyState>
      )}

      {done.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <p className="mono-label">Cleared</p>
          </div>
          <ul>
            {done.slice(0, 8).map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-0">
                <p className="text-[13px] text-muted-foreground line-through">{reminder.title}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {moment(reminder.due_date).format('D MMM')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReminderForm open={formOpen} onOpenChange={setFormOpen} departments={departments} />
    </div>
  );
}
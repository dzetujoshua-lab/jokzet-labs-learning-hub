import { Link } from 'react-router-dom';
import moment from 'moment';
import { isPast, todayISO } from '@/lib/programme';

const TONE = {
  overdue: 'bg-destructive',
  today: 'bg-primary',
  later: 'bg-muted-foreground',
};

const toneFor = (due) => {
  if (isPast(due)) return 'overdue';
  if (due === todayISO()) return 'today';
  return 'later';
};

export default function ReminderRail({ reminders }) {
  const open = reminders.filter((r) => r.status === 'open').slice(0, 5);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="mono-label">Reminders</p>
        <Link to="/reminders" className="font-mono text-[10px] text-muted-foreground hover:text-foreground">
          {reminders.filter((r) => r.status === 'open').length} open
        </Link>
      </div>

      {open.length ? (
        <ul className="mt-4 space-y-3.5">
          {open.map((reminder) => {
            const tone = toneFor(reminder.due_date);
            return (
              <li key={reminder.id} className="flex items-start gap-3">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone]}`} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-foreground">{reminder.title}</p>
                  <p
                    className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      tone === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {moment(reminder.due_date).format('ddd D MMM')}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Nothing scheduled. Add a reminder so deadlines don&apos;t rely on memory.
        </p>
      )}
    </section>
  );
}
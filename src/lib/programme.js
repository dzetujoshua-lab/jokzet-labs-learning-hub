import moment from 'moment';

export const XP_PER_LEVEL = 300;
export const PROGRAMME_XP_PER_LEVEL = 900;

export const DEPT_META = {
  fswd: { icon: 'Code2', color: 'hsl(var(--chart-1))' },
  uxui: { icon: 'PenTool', color: 'hsl(var(--chart-2))' },
  sec: { icon: 'ShieldAlert', color: 'hsl(var(--chart-3))' },
  cloud: { icon: 'Cloud', color: 'hsl(var(--chart-4))' },
  sysadmin: { icon: 'Server', color: 'hsl(var(--chart-5))' },
  ai: { icon: 'BrainCircuit', color: 'hsl(var(--chart-6))' },
  photo: { icon: 'Camera', color: 'hsl(var(--chart-7))' },
  video: { icon: 'Clapperboard', color: 'hsl(var(--chart-8))' },
  biz: { icon: 'Briefcase', color: 'hsl(var(--chart-9))' },
};

export const metaFor = (code) => DEPT_META[code] || { icon: 'Code2', color: 'hsl(var(--chart-1))' };

export const MISSION_KINDS = ['Build', 'Design', 'Drill', 'Study', 'Shoot', 'Edit', 'Write', 'Ship'];
export const EVIDENCE_TYPES = ['Screenshot', 'Photo', 'Video', 'Code', 'Document', 'Link'];
export const ASSESSMENT_TYPES = ['Practical', 'Quiz', 'Project review', 'Peer review'];
export const PIECE_STATUS = ['concept', 'building', 'shipped'];

export const levelFromXp = (xp = 0) => Math.floor(xp / XP_PER_LEVEL);

export const levelProgress = (xp = 0) => {
  const level = levelFromXp(xp);
  const inLevel = xp - level * XP_PER_LEVEL;
  return { level, inLevel, target: XP_PER_LEVEL, pct: Math.round((inLevel / XP_PER_LEVEL) * 100) };
};

export const todayISO = () => moment().format('YYYY-MM-DD');
export const fmtDate = (value, format = 'ddd D MMM') => (value ? moment(value).format(format) : '—');
export const isPast = (value) => !!value && moment(value).isBefore(moment(), 'day');

export const sortBy = (list = [], key, dir = 'desc') =>
  [...list].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return (av > bv ? 1 : -1) * (dir === 'asc' ? 1 : -1);
  });

export function computeStreak(dateStrings = []) {
  const done = new Set(dateStrings.filter(Boolean));
  const cursor = moment();
  if (!done.has(cursor.format('YYYY-MM-DD'))) cursor.subtract(1, 'day');
  let streak = 0;
  while (done.has(cursor.format('YYYY-MM-DD'))) {
    streak += 1;
    cursor.subtract(1, 'day');
  }
  return streak;
}
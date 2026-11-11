import { base44 } from '@/api/base44Client';
import { levelFromXp } from './programme';

// Marks a mission done/planned and moves the department's XP with it.
export async function setMissionStatus(mission, nextStatus, departments = []) {
  const previous = mission.status;
  if (previous === nextStatus) return;
  const wasDone = previous === 'done';
  const nowDone = nextStatus === 'done';

  await base44.entities.Mission.update(mission.id, { status: nextStatus });

  if (wasDone === nowDone) return;
  const dept = departments.find((d) => d.code === mission.department_code);
  if (!dept) return;

  const delta = (mission.xp_reward ?? 25) * (nowDone ? 1 : -1);
  const xp = Math.max(0, (dept.xp ?? 0) + delta);
  await base44.entities.Department.update(dept.id, { xp, level: levelFromXp(xp) });
}
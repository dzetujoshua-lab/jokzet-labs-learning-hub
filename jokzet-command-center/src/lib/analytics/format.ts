/** Minutes as a short label: "0h", "45m", "2.5h". Pure, so both server pages and client charts can use it. */
export const fmtHours = (minutes: number) => (minutes === 0 ? "0h" : minutes < 60 ? `${minutes}m` : `${Math.round((minutes / 60) * 10) / 10}h`);

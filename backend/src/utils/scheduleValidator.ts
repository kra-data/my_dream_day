const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;   // HH:mm

export function isValidSchedule(sc: unknown): boolean {
  if (typeof sc !== 'object' || sc === null) return false;

  return Object.entries(sc as Record<string, any>)
    .every(([day, val]) => {
      const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
      if (!DAYS.includes(day)) return false;

      if (val === null) return true;                 // 근무 없음

      return typeof val === 'object'
        && TIME_RE.test(val.start)
        && TIME_RE.test(val.end)
        && val.start < val.end;                      // 09:00 < 18:00
    });
}

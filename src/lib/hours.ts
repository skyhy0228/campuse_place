import type { DaySchedule } from "../types";

export type OpenStatus = "open" | "closed" | "unknown";

const KST = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// 접속한 기기의 시간대와 상관없이 한국 시간 기준으로 요일과 시각(분)을 구한다.
export function kstNow(date: Date) {
  const parts = Object.fromEntries(KST.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: WEEKDAY[parts.weekday] ?? 0, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// 운영시간을 명확히 해석한 곳만 판단하고, 그 외는 'unknown'으로 둔다.
export function openStatus(schedule: DaySchedule[] | null, date: Date = new Date()): OpenStatus {
  if (!schedule) return "unknown";
  const { day, minutes } = kstNow(date);
  const today = schedule[day];
  if (!today) return "closed";
  const [open, close, breakStart, breakEnd] = today;
  if (minutes < open || minutes >= close) return "closed";
  if (breakStart !== undefined && breakEnd !== undefined && minutes >= breakStart && minutes < breakEnd) return "closed";
  return "open";
}

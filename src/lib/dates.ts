// 한국 시간 기준 날짜 계산과 '오래된 정보' 판단. 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit 에서 바로 불러온다)

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_MS = 9 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 접속한 기기의 시간대와 상관없이 한국 날짜(YYYY-MM-DD)를 구한다.
export function kstDateString(date: Date): string {
  return new Date(date.getTime() + KST_MS).toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' 에 날짜를 더한다.
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// 0=일 … 6=토
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

// 그 날짜가 들어 있는 주의 월요일~일요일
export function weekRange(day: string): { start: string; end: string } {
  const start = addDays(day, -((weekdayOf(day) + 6) % 7));
  return { start, end: addDays(start, 6) };
}

export function weekDays(day: string): string[] {
  const { start } = weekRange(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// 두 날짜 중 늦은 쪽. 형식이 맞지 않는 값은 무시한다.
export function latestDate(...days: (string | undefined | null)[]): string {
  return days.filter((d): d is string => Boolean(d && ISO_DATE.test(d))).sort().at(-1) ?? "";
}

// 마지막으로 확인한 날부터 이 기간이 지나면 '오래된 정보'로 표시한다.
export const STALE_DAYS = 180;

export function daysSince(day: string, now: Date): number {
  if (!ISO_DATE.test(day)) return NaN;
  return Math.floor((Date.parse(`${kstDateString(now)}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS);
}

// 날짜를 모르는 항목은 판단하지 않는다(false).
export function isStaleDate(day: string, now: Date, days = STALE_DAYS): boolean {
  const passed = daysSince(day, now);
  return Number.isFinite(passed) && passed > days;
}

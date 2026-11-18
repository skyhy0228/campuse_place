// 버스 시간표 계산. 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit 에서 바로 불러온다)
// 시간표 자체는 운영자가 관리자 화면에서 입력한다. (supabase/schema.sql 의 bus_times)

export type DayType = "weekday" | "weekend" | "everyday";
export const DAY_TYPES: DayType[] = ["weekday", "weekend", "everyday"];

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// '7:30, 08:10 9시 5분' 처럼 적은 글에서 HH:MM 을 꺼내 정렬한다. 잘못된 시각은 버린다.
export function parseTimes(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(\d{1,2})\s*(?::|시)\s*(\d{1,2})\s*분?/g)) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    found.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return [...found].sort();
}

// day: 0=일 … 6=토 (한국 시간). 공휴일은 따로 알 수 없어 요일로만 판단한다.
export function runsOn(dayType: DayType, day: number): boolean {
  if (dayType === "everyday") return true;
  const weekend = day === 0 || day === 6;
  return dayType === "weekend" ? weekend : !weekend;
}

// 지금(분) 이후에 출발하는 시각을 n개까지
export function upcoming(times: string[], minutes: number, n = 3): string[] {
  return times.filter((t) => toMinutes(t) >= minutes).slice(0, n);
}

// 다음 출발까지 남은 분
export const minutesUntil = (time: string, minutes: number) => toMinutes(time) - minutes;

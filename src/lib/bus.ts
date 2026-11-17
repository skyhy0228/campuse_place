// 버스 시간표와 다음 버스 계산. 데이터: public/data/bus.json (충주시청 시간표 이미지를 옮긴 것)
// 이 파일은 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit/bus.test.mjs 가 Node 에서 바로 불러온다)

export interface BusTrip {
  // 정류장 순서대로 "HH:MM". 서지 않거나 시간표에 없는 정류장은 null.
  times: (string | null)[];
  // garage:08:10 = 차고지 08:10 출발, garageDirect:14:15 = 차고지 출발 교통대 직행,
  // direct = 교통대 직행, toGarage:12:55 = 차고지 12:55 도착, endsTerminal = 터미널에서 운행 끝
  note?: string;
}

export interface BusRoute {
  id: string;
  number: string;
  stops: string[];
  trips: BusTrip[];
}

export interface BusData {
  checkedAt: string;
  sources: { label: string; url: string }[];
  holidays: string[];
  // 공휴일 목록이 이 날짜까지 들어 있다. 그 뒤로는 공휴일을 알 수 없다.
  holidaysThrough: string;
  // 방학처럼 운행하지 않는 기간 (시작일·끝날 포함)
  noService: { from: string; to: string; label?: string }[];
  routes: BusRoute[];
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const KST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// 기기 시간대와 상관없이 한국 날짜(YYYY-MM-DD)·요일·자정부터 지난 초
export function kst(date: Date) {
  const p = Object.fromEntries(KST.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    day: WEEKDAY[p.weekday] ?? 0,
    seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second),
  };
}

// service: 운행일 / weekend·holiday·noService: 운행 안 함
// 공휴일 목록이 끝난 뒤의 평일은 운행일로 보되 holidaysKnown=false 로 알린다.
export type ServiceDay = { status: "service" | "weekend" | "holiday" | "noService"; holidaysKnown: boolean; label?: string };

export function serviceDay(data: Pick<BusData, "holidays" | "holidaysThrough" | "noService">, date: Date): ServiceDay {
  const { ymd, day } = kst(date);
  const holidaysKnown = ymd <= data.holidaysThrough;
  const off = data.noService.find((r) => r.from <= ymd && ymd <= r.to);
  if (off) return { status: "noService", holidaysKnown, label: off.label };
  if (day === 0 || day === 6) return { status: "weekend", holidaysKnown };
  if (data.holidays.includes(ymd)) return { status: "holiday", holidaysKnown };
  return { status: "service", holidaysKnown };
}

// 탈 수 있는 정류장: 마지막 정류장(도착만)과 시간이 하나도 없는 정류장은 뺀다.
export const boardingStops = (route: BusRoute) =>
  route.stops.map((_, i) => i).filter((i) => i < route.stops.length - 1 && route.trips.some((t) => t.times[i]));

export interface Departure {
  trip: number;
  time: string;
  minutes: number;
}

// 정류장에서 출발하는 시각 목록 (시간 순)
export function departures(route: BusRoute, stop: number): Departure[] {
  return route.trips
    .map((t, trip) => ({ trip, time: t.times[stop] ?? "" }))
    .filter((d) => d.time)
    .map((d) => ({ ...d, minutes: toMinutes(d.time) }))
    .sort((a, b) => a.minutes - b.minutes);
}

// 지금(자정부터 지난 초) 이후 출발하는 버스. 출발 시각이 된 그 분까지는 '곧 출발'로 남긴다.
export function upcoming(route: BusRoute, stop: number, nowSeconds: number, count = 3): Departure[] {
  return departures(route, stop)
    .filter((d) => d.minutes * 60 + 59 >= nowSeconds)
    .slice(0, count);
}

// 남은 시간(분, 올림). 0 이면 곧 출발.
export const minutesUntil = (dep: Pick<Departure, "minutes">, nowSeconds: number) =>
  Math.max(0, Math.ceil((dep.minutes * 60 - nowSeconds) / 60));

// note 문자열을 종류와 시각으로 나눈다.
export function parseNote(note?: string): { kind: "garage" | "garageDirect" | "direct" | "toGarage" | "endsTerminal"; time?: string } | null {
  if (!note) return null;
  const [kind, ...rest] = note.split(":");
  const time = rest.length ? rest.join(":") : undefined;
  if (kind === "garage" || kind === "garageDirect" || kind === "direct" || kind === "toGarage" || kind === "endsTerminal") return { kind, time };
  return null;
}

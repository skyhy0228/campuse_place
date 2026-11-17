// 다음 버스 알림. 출발 N분 전에 브라우저 알림(허용한 경우)과 화면 안 알림을 함께 띄운다.
// 서버 푸시가 없는 정적 사이트라, 사이트가 열려 있을 때(다른 탭이어도)만 동작한다.
// 알림 목록은 이 기기 localStorage 에만 두고, 날짜가 지난 알림은 버린다.
import { useCallback, useEffect, useRef, useState } from "react";
import { kst, toMinutes } from "./bus";

export interface BusAlarm {
  id: string;
  routeId: string;
  stop: number;
  time: string;
  // 한국 날짜 YYYY-MM-DD
  date: string;
  lead: number;
}

export interface FiredAlarm extends BusAlarm {
  firedAt: number;
}

const KEY = "busAlarms";
export const alarmId = (routeId: string, stop: number, time: string, date: string) => `${date}|${routeId}|${stop}|${time}`;

function read(): BusAlarm[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as BusAlarm[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function write(list: BusAlarm[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장소를 못 쓰면 이번 방문 동안만 기억한다.
  }
}

export type NotifyPermission = NotificationPermission | "unsupported";
const permissionNow = (): NotifyPermission => ("Notification" in window ? Notification.permission : "unsupported");

async function systemNotify(title: string, body: string, tag: string) {
  if (permissionNow() !== "granted") return;
  const options: NotificationOptions = { body, tag, icon: `${import.meta.env.BASE_URL}favicon.svg` };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // 서비스 워커가 없으면 아래로
  }
  try {
    new Notification(title, options);
  } catch {
    // 일부 모바일 브라우저는 서비스 워커 없이 알림을 만들 수 없다. 화면 안 알림만 남는다.
  }
}

// message: 알림이 울릴 때 보여 줄 제목과 본문을 만든다 (언어 반영)
export function useBusAlarms(message: (alarm: BusAlarm) => { title: string; body: string }) {
  const [alarms, setAlarms] = useState<BusAlarm[]>(() => {
    const today = kst(new Date()).ymd;
    return read().filter((a) => a.date >= today);
  });
  const [fired, setFired] = useState<FiredAlarm[]>([]);
  const [permission, setPermission] = useState<NotifyPermission>(() => permissionNow());
  const messageRef = useRef(message);
  messageRef.current = message;

  const alarmsRef = useRef(alarms);
  useEffect(() => {
    alarmsRef.current = alarms;
    write(alarms);
  }, [alarms]);

  // 다른 탭에서 바꾼 알림도 따라간다.
  useEffect(() => {
    const sync = (e: StorageEvent) => e.key === KEY && setAlarms(read());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // 10초마다 확인한다. 기기가 잠들었다 깨어나도 지난 알림을 놓치지 않도록 타이머 하나 대신 주기적으로 본다.
  useEffect(() => {
    const check = () => {
      const { ymd, seconds } = kst(new Date());
      const list = alarmsRef.current;
      const due: BusAlarm[] = [];
      const keep = list.filter((a) => {
        if (a.date < ymd) return false;
        if (a.date > ymd) return true;
        const departs = toMinutes(a.time) * 60;
        if (seconds >= departs + 60) return false; // 이미 떠난 버스 (사이트가 닫혀 있던 동안)
        if (seconds >= departs - a.lead * 60) {
          due.push(a);
          return false;
        }
        return true;
      });
      if (keep.length === list.length) return;
      alarmsRef.current = keep;
      setAlarms(keep);
      if (!due.length) return;
      for (const a of due) {
        const { title, body } = messageRef.current(a);
        void systemNotify(title, body, a.id);
      }
      navigator.vibrate?.([200, 100, 200]);
      setFired((f) => [...f, ...due.map((a) => ({ ...a, firedAt: Date.now() }))]);
    };
    check();
    const timer = window.setInterval(check, 10_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const add = useCallback(async (alarm: Omit<BusAlarm, "id">) => {
    const id = alarmId(alarm.routeId, alarm.stop, alarm.time, alarm.date);
    setAlarms((list) => [...list.filter((a) => a.id !== id), { ...alarm, id }]);
    if (permissionNow() === "default") {
      try {
        setPermission(await Notification.requestPermission());
      } catch {
        setPermission(permissionNow());
      }
    }
  }, []);

  const remove = useCallback((id: string) => setAlarms((list) => list.filter((a) => a.id !== id)), []);
  const dismiss = useCallback((id: string) => setFired((f) => f.filter((a) => a.id !== id)), []);

  return { alarms, fired, permission, add, remove, dismiss };
}

export type BusAlarmsApi = ReturnType<typeof useBusAlarms>;

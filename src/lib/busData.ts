import { useEffect, useState } from "react";
import type { BusData } from "./bus";
import { assetUrl } from "./places";

let cache: Promise<BusData> | null = null;

export function loadBus(): Promise<BusData> {
  cache ??= fetch(assetUrl("data/bus.json")).then((response) => {
    if (!response.ok) throw new Error(`버스 시간표를 불러오지 못했습니다 (${response.status})`);
    return response.json() as Promise<BusData>;
  });
  cache.catch(() => {
    cache = null; // 실패하면 다음에 다시 시도한다.
  });
  return cache;
}

export function useBusData() {
  const [data, setData] = useState<BusData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    loadBus()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, error };
}

// 몇 초마다 갱신되는 현재 시각 (남은 분 표시용)
export function useTicker(ms = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

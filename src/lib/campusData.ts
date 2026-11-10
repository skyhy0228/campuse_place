import { useEffect, useState } from "react";
import type { CampusData } from "./campus";
import { assetUrl } from "./places";

let cache: Promise<CampusData> | null = null;

export function loadCampus(): Promise<CampusData> {
  cache ??= fetch(assetUrl("data/campus.json")).then((response) => {
    if (!response.ok) throw new Error(`캠퍼스 지도 데이터를 불러오지 못했습니다 (${response.status})`);
    return response.json() as Promise<CampusData>;
  });
  cache.catch(() => {
    cache = null; // 실패하면 다음에 다시 시도한다.
  });
  return cache;
}

// enabled 가 처음 true 가 될 때 한 번 불러온다. (캠퍼스 화면을 열거나 강의실을 검색할 때)
export function useCampusData(enabled: boolean) {
  const [data, setData] = useState<CampusData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    loadCampus()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [enabled, data]);
  return { data, error };
}

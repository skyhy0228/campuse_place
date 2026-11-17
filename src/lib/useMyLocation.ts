// 내 위치를 받아 오는 훅. 위치는 이 기기 메모리에만 두고 주소·localStorage·서버에 남기지 않는다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./geo";

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "unsupported";

// 필요할 때(enabled) 한 번 위치를 받아 온다. 걷는 동안 목록이 계속 뒤바뀌지 않도록 계속 추적하지 않고, '다시 찾기'로만 갱신한다.
export function useMyLocation(enabled: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const requested = useRef(false);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ready");
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (enabled && !requested.current) {
      requested.current = true;
      locate();
    }
  }, [enabled, locate]);

  return { position, status, locate };
}

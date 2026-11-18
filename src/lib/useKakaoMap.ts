import { useEffect, useRef, useState, type RefObject } from "react";
import { loadKakaoMaps, type KakaoMaps } from "./kakaoMap";

interface MapState {
  maps: KakaoMaps;
  map: KakaoMaps;
}

// 컨테이너에 카카오 지도를 만들고, 화면에서 사라지면 정리한다. 처음 위치는 마운트할 때 한 번만 쓴다.
// level: 카카오 지도의 확대 단계 (1 이 가장 가깝고 숫자가 클수록 넓게 보인다)
export function useKakaoMap(containerRef: RefObject<HTMLElement>, initial: { lat: number; lng: number; level: number }) {
  const [state, setState] = useState<MapState | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const initialRef = useRef(initial);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const container = containerRef.current;
    setError("");
    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !container) return;
        const { lat, lng, level } = initialRef.current;
        const map = new maps.Map(container, { center: new maps.LatLng(lat, lng), level });
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        // 화면 폭이 바뀌어 컨테이너 크기가 달라지면 지도 크기를 다시 맞춘다.
        observer = new ResizeObserver(() => map.relayout?.());
        observer.observe(container);
        setState({ maps, map });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "지도를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      // 카카오 지도에는 destroy 가 없어 그린 내용을 비운다.
      if (container) container.innerHTML = "";
      setState(null);
    };
  }, [containerRef, attempt]);

  return { maps: state?.maps ?? null, map: state?.map ?? null, error, retry: () => setAttempt((n) => n + 1) };
}

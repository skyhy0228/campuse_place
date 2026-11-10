import { useEffect, useRef, useState, type RefObject } from "react";
import { AUTH_FAILURE_MESSAGE, loadNaverMaps, onAuthFailure, type NaverMaps } from "./naverMap";

interface MapState {
  maps: NaverMaps;
  map: NaverMaps;
}

// 컨테이너에 네이버 지도를 만들고, 화면에서 사라지면 정리한다. 처음 위치는 마운트할 때 한 번만 쓴다.
export function useNaverMap(containerRef: RefObject<HTMLElement>, initial: { lat: number; lng: number; zoom: number }) {
  const [state, setState] = useState<MapState | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const initialRef = useRef(initial);

  useEffect(() => onAuthFailure(() => setError(AUTH_FAILURE_MESSAGE)), []);

  useEffect(() => {
    let cancelled = false;
    let map: NaverMaps = null;
    let observer: ResizeObserver | null = null;
    setError("");
    loadNaverMaps()
      .then((maps) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        const { lat, lng, zoom } = initialRef.current;
        map = new maps.Map(container, {
          center: new maps.LatLng(lat, lng),
          zoom,
          zoomControl: true,
          zoomControlOptions: { position: maps.Position.TOP_RIGHT },
          mapDataControl: false,
        });
        // 화면 폭이 바뀌어 컨테이너 크기가 달라지면 지도 크기를 다시 맞춘다.
        observer = new ResizeObserver(() => map?.autoResize?.());
        observer.observe(container);
        setState({ maps, map });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "지도를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.destroy?.();
      setState(null);
    };
  }, [containerRef, attempt]);

  return { maps: state?.maps ?? null, map: state?.map ?? null, error, retry: () => setAttempt((n) => n + 1) };
}

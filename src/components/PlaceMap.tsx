import { ExternalLink, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadKakaoMaps, type Kakao } from "../lib/kakao";
import type { PlaceView } from "../lib/places";

interface Props {
  places: PlaceView[];
  favoriteIds: Set<string>;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

type Located = PlaceView & { lat: number; lng: number };

// 같은 좌표를 공유하는 장소(예: 교내 시설 여러 곳)를 핀 하나로 묶는다.
interface PinGroup {
  key: string;
  lat: number;
  lng: number;
  places: Located[];
}

const CATEGORY_COLORS: Record<string, string> = {
  식당: "#8a3b0b",
  카페: "#9a1f46",
  학교시설: "#134e7a",
  숨은장소: "#4c3a8f",
  생활꿀팁: "#1c5a3a",
  관광지: "#6b5200",
  자유: "#3b4452",
};
const GROUP_COLOR = "#1f2933";

const isLocated = (place: PlaceView): place is Located =>
  typeof place.lat === "number" && typeof place.lng === "number";

export function groupByCoordinate(places: PlaceView[]): PinGroup[] {
  const groups = new Map<string, PinGroup>();
  for (const place of places.filter(isLocated)) {
    const key = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
    const group = groups.get(key) ?? { key, lat: place.lat, lng: place.lng, places: [] };
    group.places.push(place);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function pinImage(kakao: Kakao, color: string, count: number) {
  const label = count > 1 ? `<text x="16" y="19" text-anchor="middle" font-size="13" font-weight="700" font-family="sans-serif" fill="#fff">${count > 99 ? "99+" : count}</text>` : `<circle cx="16" cy="15" r="5" fill="#fff"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C8 1 1.5 7.3 1.5 15.2 1.5 26 16 41 16 41s14.500-15 14.500-25.800C30.500 7.300 24 1 16 1Z" fill="${color}" stroke="#fff" stroke-width="2"/>${label}</svg>`;
  return new kakao.maps.MarkerImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    new kakao.maps.Size(32, 42),
    { offset: new kakao.maps.Point(16, 41) },
  );
}

export function PlaceMap({ places, favoriteIds, onOpen, onToggleFavorite }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Kakao>(null);
  const clustererRef = useRef<Kakao>(null);
  const markersRef = useRef<Kakao[]>([]);
  const [kakao, setKakao] = useState<Kakao>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const groups = useMemo(() => groupByCoordinate(places), [places]);
  const pinCount = groups.reduce((sum, g) => sum + g.places.length, 0);
  const active = groups.find((g) => g.key === activeKey) ?? null;
  const select = useCallback((key: string | null) => setActiveKey(key), []);

  // SDK 로드와 지도 생성
  useEffect(() => {
    let cancelled = false;
    setError("");
    loadKakaoMaps()
      .then((k) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          const map = new k.maps.Map(containerRef.current, {
            center: new k.maps.LatLng(36.97, 127.93),
            level: 7,
          });
          map.addControl(new k.maps.ZoomControl(), k.maps.ControlPosition.RIGHT);
          k.maps.event.addListener(map, "click", () => select(null));
          mapRef.current = map;
          clustererRef.current = new k.maps.MarkerClusterer({
            map,
            averageCenter: true,
            minLevel: 6,
            disableClickZoom: false,
          });
        }
        setKakao(k);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "지도를 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [attempt, select]);

  // 핀 갱신 (필터가 바뀔 때마다)
  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (!kakao || !map || !clusterer) return;

    clusterer.clear();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (!groups.length) return;

    const bounds = new kakao.maps.LatLngBounds();
    const markers = groups.map((group) => {
      const position = new kakao.maps.LatLng(group.lat, group.lng);
      bounds.extend(position);
      const single = group.places.length === 1;
      const marker = new kakao.maps.Marker({
        position,
        image: pinImage(kakao, single ? (CATEGORY_COLORS[group.places[0].category] ?? GROUP_COLOR) : GROUP_COLOR, group.places.length),
        title: single ? group.places[0].name : `${group.places.length}곳`,
      });
      kakao.maps.event.addListener(marker, "click", () => select(group.key));
      return marker;
    });
    markersRef.current = markers;
    clusterer.addMarkers(markers);

    map.relayout();
    if (groups.length === 1) {
      map.setCenter(new kakao.maps.LatLng(groups[0].lat, groups[0].lng));
      map.setLevel(3);
    } else {
      map.setBounds(bounds, 60, 40, 60, 40);
    }
  }, [kakao, groups, select]);

  // 필터로 사라진 핀의 안내 창은 닫는다.
  useEffect(() => {
    if (activeKey && !groups.some((g) => g.key === activeKey)) setActiveKey(null);
  }, [groups, activeKey]);

  // 화면에서 사라질 때 지도 객체를 정리한다.
  useEffect(
    () => () => {
      clustererRef.current?.clear();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
      clustererRef.current = null;
    },
    [],
  );

  return (
    <section className="mapView" aria-label="지도">
      <div className="mapCanvasWrap">
        <div ref={containerRef} className="mapCanvas" aria-label={`지도, 핀 ${groups.length}개`} />
        {!kakao && !error && <p className="mapOverlay">지도를 불러오는 중입니다…</p>}
        {error && (
          <div className="mapOverlay error" role="alert">
            <p>{error}</p>
            <button type="button" className="button small" onClick={() => setAttempt((n) => n + 1)}>
              다시 시도
            </button>
          </div>
        )}
        {kakao && groups.length === 0 && <p className="mapOverlay">현재 조건에 맞는 장소 중 지도에 표시할 수 있는 곳이 없습니다.</p>}

        {active && (
          <div className="pinPanel" role="dialog" aria-label="선택한 장소">
            <div className="pinPanelHead">
              <strong>{active.places.length > 1 ? `이 위치의 장소 ${active.places.length}곳` : "선택한 장소"}</strong>
              <button type="button" className="iconButton" onClick={() => select(null)} aria-label="선택 닫기">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ul className="pinList">
              {active.places.map((place) => {
                const favorite = favoriteIds.has(place.id);
                return (
                  <li key={place.id} data-category={place.category}>
                    <button type="button" className="pinItem" onClick={() => onOpen(place.id)} aria-label={`${place.name} 자세히 보기`}>
                      <span className="badge">{place.categoryLabel}</span>
                      <span className="pinName">{place.name}</span>
                      {place.summary && <span className="pinSummary">{place.summary}</span>}
                    </button>
                    <span className="actions">
                      {place.safeMapUrl && (
                        <a className="iconButton" href={place.safeMapUrl} target="_blank" rel="noopener noreferrer" aria-label={`${place.name} 네이버 지도 열기 (새 탭)`} title="네이버 지도">
                          <ExternalLink size={18} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        className={`iconButton${favorite ? " active" : ""}`}
                        onClick={() => onToggleFavorite(place.id)}
                        aria-pressed={favorite}
                        aria-label={favorite ? `${place.name} 즐겨찾기 해제` : `${place.name} 즐겨찾기 추가`}
                      >
                        <Star size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <p className="mapNote">
        지도에는 주소가 확인된 <strong>{pinCount}</strong>곳만 표시됩니다
        {places.length > pinCount ? ` (나머지 ${places.length - pinCount}곳은 목록에서 볼 수 있어요)` : ""}.
      </p>
    </section>
  );
}

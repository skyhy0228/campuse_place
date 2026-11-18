import { ExternalLink, RotateCcw, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isLocated, pinImage, type Located } from "../lib/kakaoMap";
import type { PlaceView } from "../lib/places";
import { useKakaoMap } from "../lib/useKakaoMap";

interface Props {
  places: PlaceView[];
  favoriteIds: Set<string>;
  // 상세의 '지도에서 보기'로 넘어온 장소. 그 위치로 옮기고 안내 창을 연다.
  focusId?: string | null;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onShowList: () => void;
}

// 같은 좌표를 공유하는 장소(같은 건물의 여러 가게 등)를 핀 하나로 묶는다.
interface PinGroup {
  key: string;
  lat: number;
  lng: number;
  places: Located[];
}

// 처음 보이는 위치: 학교와 대학로 일대
const CAMPUS = { lat: 36.966, lng: 127.872, level: 5 };
// 장소 하나를 보여줄 때의 확대 단계, 여러 곳을 맞출 때 이보다 더 가까이 가지 않는다.
const CLOSE_LEVEL = 3;
// 이 단계보다 넓게 볼 때 가까운 핀을 숫자 원으로 묶는다.
const CLUSTER_LEVEL = 6;

function groupByCoordinate(places: PlaceView[]): PinGroup[] {
  const groups = new Map<string, PinGroup>();
  for (const place of places.filter(isLocated)) {
    const key = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
    const group = groups.get(key) ?? { key, lat: place.lat, lng: place.lng, places: [] };
    group.places.push(place);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function PlaceMap({ places, favoriteIds, focusId = null, onOpen, onToggleFavorite, onShowList }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { maps, map, error, retry } = useKakaoMap(containerRef, CAMPUS);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const groups = useMemo(() => groupByCoordinate(places), [places]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  // 핀 구성이 실제로 바뀔 때만 핀을 다시 그린다. (정렬이나 '영업 중' 시각 갱신으로 목록만 새로 만들어질 때는 지도 위치를 유지)
  const pinKey = groups
    .map((g) => `${g.key}:${g.places.map((p) => p.id).sort().join(",")}`)
    .sort()
    .join("|");
  const pinCount = groups.reduce((sum, g) => sum + g.places.length, 0);
  const active = groups.find((g) => g.key === activeKey) ?? null;

  useEffect(() => {
    if (!maps || !map) return;
    const current = groupsRef.current;
    const markers = current.map((group) => {
      const single = group.places.length === 1;
      const marker = new maps.Marker({
        position: new maps.LatLng(group.lat, group.lng),
        image: pinImage(maps, group.places[0].category, group.places.length),
        title: single ? group.places[0].name : `${group.places[0].name} 외 ${group.places.length - 1}곳`,
        zIndex: single ? 1 : 2,
      });
      maps.event.addListener(marker, "click", () => setActiveKey(group.key));
      return marker;
    });
    // 멀리서 볼 때는 가까운 핀을 숫자 원으로 묶고, 원을 누르면 한 단계 가까이 간다.
    const clusterer = new maps.MarkerClusterer({ map, averageCenter: true, minLevel: CLUSTER_LEVEL });
    clusterer.addMarkers(markers);
    const closePanel = () => setActiveKey(null);
    maps.event.addListener(map, "click", closePanel);

    map.relayout();
    if (current.length === 1) {
      map.setCenter(new maps.LatLng(current[0].lat, current[0].lng));
      map.setLevel(CLOSE_LEVEL);
    } else if (current.length > 1) {
      const bounds = new maps.LatLngBounds();
      current.forEach((g) => bounds.extend(new maps.LatLng(g.lat, g.lng)));
      map.setBounds(bounds, 48, 48, 48, 48);
      if (map.getLevel() < CLOSE_LEVEL) map.setLevel(CLOSE_LEVEL);
    }

    return () => {
      maps.event.removeListener(map, "click", closePanel);
      clusterer.clear();
      clusterer.setMap?.(null);
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [maps, map, pinKey]);

  useEffect(() => {
    if (!maps || !map || !focusId) return;
    const group = groupsRef.current.find((g) => g.places.some((p) => p.id === focusId));
    if (!group) return;
    map.setLevel(CLOSE_LEVEL);
    map.setCenter(new maps.LatLng(group.lat, group.lng));
    setActiveKey(group.key);
  }, [maps, map, focusId]);

  // 필터로 사라진 핀의 안내 창은 닫는다.
  useEffect(() => {
    if (activeKey && !groups.some((g) => g.key === activeKey)) setActiveKey(null);
  }, [groups, activeKey]);

  return (
    <section className="mapView" aria-label="지도 보기">
      <div className="mapCanvasWrap">
        <div ref={containerRef} className="mapCanvas" role="application" aria-label={`장소 지도, 핀 ${groups.length}개`} />
        {!map && !error && <p className="mapOverlay">지도를 불러오는 중입니다…</p>}
        {error && (
          <div className="mapOverlay error" role="alert">
            <p>{error}</p>
            <button type="button" className="button small" onClick={retry}>
              <RotateCcw size={15} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        )}
        {map && !error && groups.length === 0 && (
          <div className="mapOverlay">
            <p>현재 조건에 맞는 장소 중 지도에 표시할 수 있는 곳이 없습니다.</p>
            <button type="button" className="button small" onClick={onShowList}>
              목록으로 보기
            </button>
          </div>
        )}

        {active && (
          <div
            className="pinPanel"
            role="region"
            aria-label="선택한 위치의 장소"
            onKeyDown={(event) => event.key === "Escape" && setActiveKey(null)}
          >
            <div className="pinPanelHead">
              <strong>{active.places.length > 1 ? `이 위치의 장소 ${active.places.length}곳` : "선택한 장소"}</strong>
              <button type="button" className="iconButton" onClick={() => setActiveKey(null)} aria-label="선택 닫기">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ul className="pinList">
              {active.places.map((place) => {
                const favorite = favoriteIds.has(place.id);
                return (
                  <li key={place.id} data-category={place.category}>
                    <button type="button" className="pinItem" onClick={() => onOpen(place.id)}>
                      <span className="badge">{place.categoryLabel}</span>
                      <span className="pinName">{place.name}</span>
                      {place.summary && <span className="pinSummary">{place.summary}</span>}
                    </button>
                    <span className="pinActions">
                      {/* 원본 데이터의 지도 링크(네이버 지도 주소)가 있으면 그대로 연다 */}
                      {place.safeMapUrl && (
                        <a
                          className="iconButton"
                          href={place.safeMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${place.name} 네이버 지도에서 열기 (새 탭)`}
                          title="네이버 지도에서 열기"
                        >
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
        주소로 위치가 특정된 <strong>{pinCount}</strong>곳만 핀으로 표시합니다
        {places.length > pinCount ? ` (나머지 ${places.length - pinCount}곳은 목록에서 볼 수 있어요)` : ""}. 핀 위치는 주소 기준이라
        실제 입구와 다를 수 있습니다.
      </p>
    </section>
  );
}

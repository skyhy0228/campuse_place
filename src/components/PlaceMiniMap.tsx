import { useEffect, useRef } from "react";
import { pinIcon, type Located } from "../lib/naverMap";
import { useNaverMap } from "../lib/useNaverMap";

// 상세 보기 안의 작은 지도. 장소 하나에 핀을 꽂는다.
export function PlaceMiniMap({ place }: { place: Located }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { maps, map, error } = useNaverMap(containerRef, { lat: place.lat, lng: place.lng, zoom: 17 });

  useEffect(() => {
    if (!maps || !map) return;
    const position = new maps.LatLng(place.lat, place.lng);
    map.setCenter(position);
    const marker = new maps.Marker({ position, map, icon: pinIcon(maps, place.category), title: place.name, clickable: false });
    return () => marker.setMap(null);
  }, [maps, map, place.lat, place.lng, place.category, place.name]);

  return (
    <section className="miniMap" aria-label="지도">
      <div ref={containerRef} className="miniMapCanvas" role="application" aria-label={`${place.name} 위치 지도`} />
      {(!map || error) && <p className={`mapOverlay${error ? " error" : ""}`}>{error || "지도를 불러오는 중입니다…"}</p>}
    </section>
  );
}

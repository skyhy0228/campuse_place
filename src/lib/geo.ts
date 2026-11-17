// 내 위치 기준 거리 계산. 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit/geo.test.mjs 가 Node 에서 바로 불러온다)

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

// 두 좌표 사이의 직선거리(m). 하버사인 공식.
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 좌표가 없는 장소는 undefined.
export function distanceFrom(origin: LatLng | null | undefined, place: { lat?: number; lng?: number }): number | undefined {
  if (!origin || place.lat === undefined || place.lng === undefined) return undefined;
  return distanceMeters(origin, { lat: place.lat, lng: place.lng });
}

// 350m · 1.2km · 12km
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)}m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m / 1000)}km`;
}

// 직선거리 기준 도보 시간(분). 분당 약 67m(시속 4km).
export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 67));

// 가까운 순으로 정렬한다. 좌표가 없는 장소는 뒤로 보내고 tieBreak(기본 순서)를 따른다.
export function sortByDistance<T extends { lat?: number; lng?: number }>(items: T[], origin: LatLng, tieBreak: (a: T, b: T) => number): T[] {
  const withDistance = items.map((item) => ({ item, d: distanceFrom(origin, item) }));
  withDistance.sort((a, b) => {
    if (a.d !== undefined && b.d !== undefined) return a.d - b.d || tieBreak(a.item, b.item);
    if (a.d !== undefined) return -1;
    if (b.d !== undefined) return 1;
    return tieBreak(a.item, b.item);
  });
  return withDistance.map((x) => x.item);
}

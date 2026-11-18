// 가까운 순 정렬에 쓰는 거리 계산. 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit 에서 바로 불러온다)

export interface LatLng {
  lat: number;
  lng: number;
}

// 학교 대표 주소(충북 충주시 대소원면 대학로 50). 위치 권한이 없을 때 거리의 기준점으로 쓴다.
export const SCHOOL: LatLng = { lat: 36.9688, lng: 127.8728 };

const EARTH_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

// 두 지점 사이의 직선거리(m). 걷는 길이가 아니라 대략적인 비교용이다.
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// 1km 미만은 10m 단위, 그 이상은 0.1km 단위로 보여준다.
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// 거리를 모르는 항목(undefined)은 맨 뒤로 보낸다.
export function compareDistance(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

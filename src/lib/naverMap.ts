// 네이버 지도 JavaScript API v3 로더. 키(VITE_NAVER_MAP_CLIENT_ID)가 없으면 지도 기능을 숨긴다.
// - 키는 네이버 클라우드 플랫폼 Maps 의 Client ID 이며, 콘솔에 등록한 Web 서비스 URL 에서만 동작한다.
// - API는 공식 타입 패키지 없이 쓰므로 필요한 부분만 느슨하게 다룬다.
import type { PlaceView } from "./places";

export type NaverMaps = any;

declare global {
  interface Window {
    naver?: { maps?: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

const CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
export const mapEnabled = Boolean(CLIENT_ID);

const SCRIPT_ID = "naver-maps-sdk";
export const AUTH_FAILURE_MESSAGE = "네이버 지도 인증에 실패했습니다. 콘솔에 이 사이트 주소가 Web 서비스 URL로 등록되어 있는지 확인하세요.";

let loading: Promise<NaverMaps> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

// 인증 실패는 스크립트를 불러온 뒤 비동기로 알려지므로, 지도를 쓰는 화면이 구독해 오류를 표시한다.
export function onAuthFailure(listener: () => void) {
  if (authFailed) listener();
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function loadNaverMaps(): Promise<NaverMaps> {
  if (!CLIENT_ID) return Promise.reject(new Error("지도 키가 설정되지 않았습니다."));
  if (authFailed) return Promise.reject(new Error(AUTH_FAILURE_MESSAGE));
  if (loading) return loading;

  window.navermap_authFailure = () => {
    authFailed = true;
    authListeners.forEach((listener) => listener());
  };

  loading = new Promise<NaverMaps>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null; // 다시 시도할 수 있게 비운다.
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail("지도를 불러오는 시간이 초과되었습니다."), 12000);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(CLIENT_ID)}`;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.naver?.maps?.Map) resolve(window.naver.maps);
      else fail("지도 API를 초기화하지 못했습니다.");
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail("지도를 불러오지 못했습니다. 네트워크 연결을 확인하세요.");
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type Located = PlaceView & { lat: number; lng: number };

export const isLocated = (place: PlaceView): place is Located =>
  typeof place.lat === "number" && typeof place.lng === "number";

// 분류별 핀 색. 지도 위에서는 화면 테마와 상관없이 같은 색을 쓴다. (styles.css 의 --cat-fg 밝은 화면 값)
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

// 핀 모양(HTML 아이콘). count 가 2 이상이면 같은 위치의 장소 수를 표시한다.
export function pinIcon(maps: NaverMaps, category: string, count = 1) {
  const color = count > 1 ? GROUP_COLOR : (CATEGORY_COLORS[category] ?? GROUP_COLOR);
  const label =
    count > 1
      ? `<text x="16" y="20" text-anchor="middle" font-size="13" font-weight="700" font-family="sans-serif" fill="#fff">${count > 99 ? "99+" : count}</text>`
      : `<circle cx="16" cy="15" r="5" fill="#fff"/>`;
  return {
    content: `<svg class="mapPin" xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C8 1 1.5 7.3 1.5 15.2 1.5 26 16 41 16 41s14.5-15 14.5-25.8C30.5 7.3 24 1 16 1Z" fill="${color}" stroke="#fff" stroke-width="2"/>${label}</svg>`,
    size: new maps.Size(32, 42),
    anchor: new maps.Point(16, 41),
  };
}

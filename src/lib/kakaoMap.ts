// 카카오 지도 JavaScript SDK 로더. 키(VITE_KAKAO_MAP_KEY)가 없으면 지도 기능을 숨긴다.
// - 키는 Kakao Developers 앱의 JavaScript 키다. 브라우저에 공개되는 값이며, 콘솔에 등록한 JavaScript SDK 도메인에서만 동작한다.
// - 같은 위치의 핀이 많아 멀리서 볼 때는 클러스터러로 묶는다. (팀원 프로젝트 '교통여지도'의 지도 구성을 따랐다)
// - SDK는 공식 타입 패키지 없이 쓰므로 필요한 부분만 느슨하게 다룬다.
import type { PlaceView } from "./places";

export type KakaoMaps = any;

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

const APP_KEY = (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined)?.trim();
export const mapEnabled = Boolean(APP_KEY);

const SCRIPT_ID = "kakao-maps-sdk";
export const DOMAIN_HINT = "Kakao Developers 앱의 JavaScript SDK 도메인에 이 사이트 주소가 등록되어 있는지 확인하세요.";

let loading: Promise<KakaoMaps> | null = null;

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (!APP_KEY) return Promise.reject(new Error("지도 키가 설정되지 않았습니다."));
  if (loading) return loading;

  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null; // 다시 시도할 수 있게 비운다.
      document.getElementById(SCRIPT_ID)?.remove();
      reject(new Error(message));
    };
    // 등록하지 않은 도메인에서는 SDK가 응답하지 않거나 오류를 낸다.
    const timer = window.setTimeout(() => fail(`지도를 불러오는 시간이 초과되었습니다. ${DOMAIN_HINT}`), 12000);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(APP_KEY)}&autoload=false&libraries=clusterer`;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps?.load) {
        window.clearTimeout(timer);
        fail("지도 SDK를 초기화하지 못했습니다.");
        return;
      }
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail(`지도를 불러오지 못했습니다. 네트워크를 확인하고, ${DOMAIN_HINT}`);
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type Located = PlaceView & { lat: number; lng: number };

export const isLocated = (place: PlaceView): place is Located =>
  typeof place.lat === "number" && typeof place.lng === "number";

// 카카오맵 웹에서 그 위치를 여는 링크 (앱·키가 필요 없다)
export const kakaoMapLink = (place: Located) =>
  `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;

// 분류별 핀 색. 지도 위에서는 화면 테마와 상관없이 같은 색을 쓴다. (styles.css 의 --cat-fg 밝은 화면 값)
const CATEGORY_COLORS: Record<string, string> = {
  식당: "#8a3b0b",
  카페: "#9a1f46",
  학교시설: "#134e7a",
  숨은장소: "#4c3a8f",
  생활꿀팁: "#1c5a3a",
  관광지: "#6b5200",
  자유: "#3b4452",
  유학생: "#9b2c1f",
  제보: "#1f4e6b",
};
const GROUP_COLOR = "#1f2933";

// 핀 그림(SVG 데이터 주소). count 가 2 이상이면 같은 위치의 장소 수를 표시한다.
export function pinImage(maps: KakaoMaps, category: string, count = 1) {
  const color = count > 1 ? GROUP_COLOR : (CATEGORY_COLORS[category] ?? GROUP_COLOR);
  const label =
    count > 1
      ? `<text x="16" y="20" text-anchor="middle" font-size="13" font-weight="700" font-family="sans-serif" fill="#fff">${count > 99 ? "99+" : count}</text>`
      : `<circle cx="16" cy="15" r="5" fill="#fff"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 1C8 1 1.5 7.3 1.5 15.2 1.5 26 16 41 16 41s14.5-15 14.5-25.8C30.5 7.3 24 1 16 1Z" fill="${color}" stroke="#fff" stroke-width="2"/>${label}</svg>`;
  return new maps.MarkerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, new maps.Size(32, 42), {
    offset: new maps.Point(16, 41),
  });
}

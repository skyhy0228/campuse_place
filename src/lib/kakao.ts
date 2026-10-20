// 카카오맵 JavaScript SDK 로더. 키(VITE_KAKAO_MAP_JS_KEY)가 없으면 지도 기능을 숨긴다.
// SDK는 공식 타입 패키지 없이 쓰므로 필요한 부분만 느슨하게 다룬다.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Kakao = any;

declare global {
  interface Window {
    kakao?: Kakao;
  }
}

const APP_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY as string | undefined;
export const mapEnabled = Boolean(APP_KEY);

let loading: Promise<Kakao> | null = null;

export function loadKakaoMaps(): Promise<Kakao> {
  if (!APP_KEY) return Promise.reject(new Error("지도 키가 설정되지 않았습니다."));
  if (loading) return loading;

  loading = new Promise<Kakao>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null; // 다시 시도할 수 있게 비운다.
      document.getElementById("kakao-maps-sdk")?.remove();
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail("지도를 불러오는 시간이 초과되었습니다."), 12000);

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(APP_KEY)}&autoload=false&libraries=clusterer`;
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        window.clearTimeout(timer);
        fail("지도 SDK를 초기화하지 못했습니다.");
        return;
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timer);
        resolve(window.kakao);
      });
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      fail("지도 SDK를 불러오지 못했습니다. 네트워크와 허용 도메인 설정을 확인하세요.");
    };
    document.head.appendChild(script);
  });
  return loading;
}

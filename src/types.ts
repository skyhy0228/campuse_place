// 요일(0=일 … 6=토)별 [열림분, 닫힘분, 쉬는시작분?, 쉬는끝분?]. 휴무는 null.
export type DaySchedule = number[] | null;

export type PriceBand = "" | "free" | "under10" | "10to20" | "over20";
export type Campus = "" | "in" | "out";

export interface Place {
  id: string;
  name: string;
  category: string;
  location: string;
  locationNotes: string[];
  campus: Campus;
  mapUrl: string;
  hours: string;
  // 요일과 시간을 명확히 해석한 경우에만 값이 있다.
  schedule: DaySchedule[] | null;
  price: string;
  priceBand: PriceBand;
  menu: string;
  summary: string;
  details: string;
  recommendations: number;
  checkedAt: string;
  checkedSort: string;
  images: string[];
  // 주소로 위치가 특정되는 항목에만 있다 (data/place-coordinates.json).
  lat?: number;
  lng?: number;

  // ---- 팀원 데이터 (scripts/lib/teams.mjs) ----
  // 교통여지도: 음식 종류와 예시 사진 키, 구역, 기본 별점, 혼밥, 휴무일, 학교에서 거리, 네이버 리뷰 키워드, 정리된 설명
  foodType?: string;
  foodPhoto?: string;
  zone?: Zone;
  baseRating?: number;
  solo?: "good" | "ok" | "hard";
  closedDays?: string;
  distanceKm?: number;
  reviewKeywords?: ReviewKeyword[];
  review?: { summary: string; detail: string };
  // knut 가이드: 중국어 번역과 유학생 팁
  zh?: ZhText;
  intl?: { ko: string; zh: string };
  // ut 꿀팁 지도: 캠퍼스 지도 위 위치(m 단위, 왼쪽 위 원점)
  campusXY?: { x: number; y: number; building?: string; approx?: boolean };
  // 원본 XLSX 가 아닌 곳에서 온 항목 ('knut' 유학생 꿀팁, 'report' 학생 제보)
  source?: "knut" | "report";
}

export type Zone = "front" | "city" | "suburb";

export interface ReviewKeyword {
  label: string;
  count: number;
  // '500건이 넘는다'처럼 하한만 알려진 경우
  over?: boolean;
}

export interface ZhText {
  name?: string;
  location?: string;
  menu?: string;
  hours?: string;
  price?: string;
  summary?: string;
  note?: string;
}

export interface PlacesFile {
  count: number;
  places: Place[];
}

export type SortKey = "recommendations" | "rating" | "name" | "checked";

export interface Filters {
  query: string;
  category: string;
  sort: SortKey;
  // '' = 전체, 'fav' = 즐겨찾기, 'c:<id>' = 내 목록
  list: string;
  openNow: boolean;
  campus: Campus;
  price: PriceBand;
  // 교통여지도: 구역과 음식 종류
  zone: "" | Zone;
  food: string;
  // knut: 유학생 추천만
  intl: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  category: "",
  sort: "recommendations",
  list: "",
  openNow: false,
  campus: "",
  price: "",
  zone: "",
  food: "",
  intl: false,
};

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
}

export interface PlacesFile {
  count: number;
  places: Place[];
}

export type SortKey = "recommendations" | "name" | "checked";

export interface Filters {
  query: string;
  category: string;
  sort: SortKey;
  // '' = 전체, 'fav' = 즐겨찾기, 'c:<id>' = 내 목록
  list: string;
  openNow: boolean;
  campus: Campus;
  price: PriceBand;
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  category: "",
  sort: "recommendations",
  list: "",
  openNow: false,
  campus: "",
  price: "",
};

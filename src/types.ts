export interface Place {
  id: string;
  name: string;
  category: string;
  location: string;
  mapUrl: string;
  hours: string;
  price: string;
  menu: string;
  summary: string;
  details: string;
  recommendations: number;
  checkedAt: string;
  checkedSort: string;
  images: string[];
  // 주소를 좌표로 변환한 항목에만 있다 (npm run geocode).
  lat?: number;
  lng?: number;
}

export interface PlacesFile {
  count: number;
  places: Place[];
}

export type SortKey = "recommendations" | "name" | "checked";

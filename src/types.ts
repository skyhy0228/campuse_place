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
}

export interface PlacesFile {
  count: number;
  places: Place[];
}

export type SortKey = "recommendations" | "name" | "checked";

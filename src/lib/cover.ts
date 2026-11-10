// 카드와 상세에 쓸 대표 사진을 고른다.
// 실제 사진(place.images)이 있으면 그것을, 없으면 맛집·카페에 한해 음식 종류별 AI 예시 사진(교통여지도)을 쓴다.
import type { Dict } from "./i18n";
import { assetUrl, type PlaceView } from "./places";

export interface Cover {
  src: string;
  srcSet?: string;
  alt: string;
  ai: boolean;
}

export const foodPhotoUrl = (key: string, size: 480 | 960 = 960) =>
  assetUrl(`images/food/${key}${size === 480 ? "-480" : ""}.webp`);

export function coverFor(place: PlaceView, t: Dict, name: string): Cover | null {
  if (place.images[0]) return { src: place.images[0], alt: t.photoOf(name), ai: false };
  if (place.foodPhoto) {
    return {
      src: `images/food/${place.foodPhoto}.webp`,
      srcSet: `${foodPhotoUrl(place.foodPhoto, 480)} 480w, ${foodPhotoUrl(place.foodPhoto)} 960w`,
      alt: t.aiPhotoAlt(t.foodNames[place.foodType ?? ""] ?? t.categoryNames[place.category] ?? ""),
      ai: true,
    };
  }
  return null;
}

// 운영자가 승인한 학생 제보(새 장소)를 목록·지도에 같이 보여주려고 장소 형식으로 바꾼다.
import type { Place } from "../types";
import { campusXYFromLatLng } from "./campus";
import type { Submission } from "./remote";
import { photoUrl } from "./supabase";

// 제보 id(uuid) 앞 8자리로 만든다. 원본 장소(p…)와 겹치지 않게 q 로 시작한다.
export const submissionPlaceId = (id: string) => `q${id.replace(/-/g, "").slice(0, 8)}`;

export function submissionToPlace(s: Submission): Place {
  const located = typeof s.lat === "number" && typeof s.lng === "number";
  const campusXY = located ? campusXYFromLatLng(s.lat!, s.lng!) : null;
  const checked = (s.reviewed_at ?? s.created_at).slice(0, 10);
  const [summary, ...rest] = s.body.split(/\n+/);
  return {
    id: submissionPlaceId(s.id),
    name: s.name,
    category: s.category,
    location: s.location ?? "",
    locationNotes: [],
    campus: "",
    mapUrl: s.map_url ?? "",
    hours: "",
    schedule: null,
    price: "",
    priceBand: "",
    menu: "",
    summary: summary.slice(0, 120),
    details: rest.join(" / "),
    recommendations: 1,
    checkedAt: checked,
    checkedSort: checked,
    images: s.photos.map(photoUrl),
    ...(located ? { lat: s.lat!, lng: s.lng! } : {}),
    ...(campusXY ? { campusXY: { ...campusXY, approx: true } } : {}),
    source: "report",
  };
}

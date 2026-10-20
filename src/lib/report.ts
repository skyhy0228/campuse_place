import { REPO } from "../config";
import type { PlaceView } from "./places";

const ISSUES = `https://github.com/${REPO}/issues/new`;

// 장소 정보가 다를 때 쓰는 GitHub 이슈 작성 화면. 장소 이름이 미리 채워진다.
export function reportUrl(place: Pick<PlaceView, "id" | "name">) {
  const params = new URLSearchParams({
    template: "report.yml",
    title: `[제보] ${place.name}`,
    place: place.name,
    place_id: place.id,
  });
  return `${ISSUES}?${params}`;
}

// 목록에 없는 새로운 장소·꿀팁을 알려줄 때 쓰는 이슈 작성 화면.
export const newPlaceUrl = `${ISSUES}?${new URLSearchParams({ template: "new-place.yml", title: "[새 장소] " })}`;

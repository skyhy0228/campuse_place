import { createHash } from "node:crypto";

// 장소 이름에서 항상 같은 ID를 만든다. 즐겨찾기와 이미지 파일명에 쓰이므로 규칙을 바꾸지 않는다.
export function placeId(name) {
  return "p" + createHash("sha1").update(name.normalize("NFC")).digest("hex").slice(0, 8);
}

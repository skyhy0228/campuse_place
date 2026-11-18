// 내 목록을 링크로 공유한다. 서버에 저장하지 않고 목록 이름과 장소 ID 만 주소에 담는다.
// 예: ?list=shared&ln=점심%20후보&ids=p0b6d6685,p17bb25f2
// 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit 에서 바로 불러온다)

export interface SharedList {
  name: string;
  ids: string[];
}

const PLACE_ID = /^[pq][0-9a-f]{8}$/;
export const MAX_SHARED_IDS = 100;
export const MAX_SHARED_NAME = 30;

// 주소에서 읽은 값은 믿지 않는다. 형식이 맞는 ID 만 남기고, 이름은 제어 문자를 빼고 자른다.
export function sharedListFromParams(params: URLSearchParams): SharedList | null {
  const ids = [
    ...new Set(
      (params.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => PLACE_ID.test(id)),
    ),
  ].slice(0, MAX_SHARED_IDS);
  if (!ids.length) return null;
  const name = (params.get("ln") ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_SHARED_NAME);
  return { name, ids };
}

export function writeSharedList(params: URLSearchParams, list: SharedList) {
  if (list.name) params.set("ln", list.name.slice(0, MAX_SHARED_NAME));
  params.set("ids", list.ids.filter((id) => PLACE_ID.test(id)).slice(0, MAX_SHARED_IDS).join(","));
}

// base: 사이트 주소 (예: https://skyhy0228.github.io/campuse_place/)
export function sharedListUrl(base: string, list: SharedList): string {
  const params = new URLSearchParams();
  params.set("list", "shared");
  writeSharedList(params, list);
  return `${base}?${params.toString()}`;
}

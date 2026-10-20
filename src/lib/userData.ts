// 로그인한 사용자의 즐겨찾기·내 목록과 로그인하지 않은 사용자의 즐겨찾기를 저장한다.

export interface Collection {
  id: string;
  name: string;
  placeIds: string[];
}

export interface UserData {
  favorites: string[];
  collections: Collection[];
}

export const MAX_COLLECTIONS = 30;
export const MAX_COLLECTION_NAME = 30;

const GUEST_KEY = "campuse-place:favorites:v1";
export const accountDataKey = (userId: string) => `campuse:v1:data:${userId}`;
export const emptyData = (): UserData => ({ favorites: [], collections: [] });

const PLACE_ID = /^p[0-9a-f]{8}$/;
const uniq = (items: string[]) => [...new Set(items)];

// 저장소나 가져온 파일의 내용을 믿지 않고 형식을 걸러낸다.
export function sanitizeData(raw: unknown): UserData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = (value: unknown) =>
    uniq(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && PLACE_ID.test(v)) : []);
  const collections: Collection[] = [];
  if (Array.isArray(obj.collections)) {
    for (const item of obj.collections.slice(0, MAX_COLLECTIONS)) {
      const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const name = typeof c.name === "string" ? c.name.trim().slice(0, MAX_COLLECTION_NAME) : "";
      const id = typeof c.id === "string" && /^[\w-]{1,40}$/.test(c.id) ? c.id : "";
      if (name && id && !collections.some((x) => x.id === id)) collections.push({ id, name, placeIds: ids(c.placeIds) });
    }
  }
  return { favorites: ids(obj.favorites), collections };
}

function readStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 현재 화면에만 유지한다.
  }
}

export const readAccountData = (userId: string) => sanitizeData(readStorage(accountDataKey(userId)));
export const writeAccountData = (userId: string, data: UserData) => writeStorage(accountDataKey(userId), data);

export const GUEST_STORAGE_KEY = GUEST_KEY;
export const readGuestFavorites = () => sanitizeData({ favorites: readStorage(GUEST_KEY) }).favorites;
export const writeGuestFavorites = (ids: string[]) => writeStorage(GUEST_KEY, ids);

// 가져온 데이터를 기존 데이터에 합친다. 같은 이름의 목록은 항목만 합친다.
export function mergeData(base: UserData, incoming: UserData): UserData {
  const collections = base.collections.map((c) => ({ ...c, placeIds: [...c.placeIds] }));
  for (const inc of incoming.collections) {
    const same = collections.find((c) => c.id === inc.id || c.name === inc.name);
    if (same) same.placeIds = uniq([...same.placeIds, ...inc.placeIds]);
    else if (collections.length < MAX_COLLECTIONS) collections.push({ ...inc, placeIds: [...inc.placeIds] });
  }
  return { favorites: uniq([...base.favorites, ...incoming.favorites]), collections };
}

export const newCollectionId = () => `c${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

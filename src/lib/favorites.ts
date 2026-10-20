import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "campuse-place:favorites:v1";

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 현재 세션에만 유지한다.
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(read);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      write(next);
      return next;
    });
  }, []);

  return { favoriteIds: new Set(ids), toggle };
}

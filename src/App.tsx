import { List, Map as MapIcon, MapPin, RotateCcw, Search, SearchX, Star, TriangleAlert, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PlaceCard } from "./components/PlaceCard";
import { PlaceDialog } from "./components/PlaceDialog";
import { PlaceMap } from "./components/PlaceMap";
import { useFavorites } from "./lib/favorites";
import { mapEnabled } from "./lib/kakao";
import { buildCategories, loadPlaces, matchesQuery, sortPlaces, type PlaceView } from "./lib/places";
import type { SortKey } from "./types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; places: PlaceView[] };

const DEFAULT_SORT: SortKey = "recommendations";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommendations", label: "추천수 높은 순" },
  { value: "name", label: "이름순" },
  { value: "checked", label: "확인한날 최신순" },
];

const parseHash = () => {
  const match = location.hash.match(/^#place=([\w-]+)$/);
  return match ? match[1] : null;
};

export default function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(parseHash);
  const { favoriteIds, toggle } = useFavorites();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadPlaces(controller.signal)
      .then((places) => setState({ status: "ready", places }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "알 수 없는 오류" });
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const sync = () => setSelectedId(parseHash());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const openPlace = useCallback((id: string) => {
    history.pushState({ modal: true }, "", `#place=${id}`);
    setSelectedId(id);
  }, []);

  const closePlace = useCallback(() => {
    if ((history.state as { modal?: boolean } | null)?.modal) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      setSelectedId(null);
    }
  }, []);

  const places = state.status === "ready" ? state.places : null;
  const categories = useMemo(() => (places ? buildCategories(places) : []), [places]);

  const visible = useMemo(() => {
    if (!places) return [];
    const filtered = places.filter(
      (place) =>
        (!category || place.category === category) &&
        (!onlyFavorites || favoriteIds.has(place.id)) &&
        matchesQuery(place, deferredQuery),
    );
    return sortPlaces(filtered, sort);
  }, [places, category, onlyFavorites, favoriteIds, deferredQuery, sort]);

  const hasCoordinates = Boolean(places?.some((p) => p.lat !== undefined && p.lng !== undefined));
  const showMap = mapEnabled && hasCoordinates && view === "map";
  const selected = places?.find((place) => place.id === selectedId) ?? null;
  const filtersActive = Boolean(query || category || onlyFavorites || sort !== DEFAULT_SORT);
  const favoriteCount = places ? places.filter((p) => favoriteIds.has(p.id)).length : 0;

  const resetFilters = () => {
    setQuery("");
    setCategory("");
    setSort(DEFAULT_SORT);
    setOnlyFavorites(false);
  };

  return (
    <div className="app">
      <header className="top">
        <div className="topInner">
          <div className="brand">
            <span className="brandMark" aria-hidden="true">
              <MapPin size={20} />
            </span>
            <div>
              <h1>교통대 꿀팁 모음</h1>
              <p>국립한국교통대학교 충주캠퍼스 학생들이 직접 모은 정보</p>
            </div>
          </div>

          <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="search" className="srOnly">
              통합 검색
            </label>
            <Search size={18} className="searchIcon" aria-hidden="true" />
            <input
              id="search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="장소, 메뉴, 위치, 팁 검색"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="clear" onClick={() => setQuery("")} aria-label="검색어 지우기">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </form>
        </div>
      </header>

      <main className="main">
        {places && (
          <section className="controls" aria-label="필터와 정렬">
            <div className="chipRow" role="group" aria-label="분류">
              <button type="button" className="chip" aria-pressed={!category} onClick={() => setCategory("")}>
                전체 <span className="count">{places.length}</span>
              </button>
              {categories.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="chip"
                  data-category={option.value}
                  aria-pressed={category === option.value}
                  onClick={() => setCategory(category === option.value ? "" : option.value)}
                >
                  {option.label} <span className="count">{option.count}</span>
                </button>
              ))}
            </div>

            <div className="toolRow">
              <p className="resultCount" role="status" aria-live="polite">
                검색 결과 <strong>{visible.length}</strong>개
              </p>
              <div className="toolActions">
                {mapEnabled && hasCoordinates && (
                  <div className="viewToggle" role="group" aria-label="보기 방식">
                    <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
                      <List size={15} aria-hidden="true" />
                      목록
                    </button>
                    <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
                      <MapIcon size={15} aria-hidden="true" />
                      지도
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className={`button small${onlyFavorites ? " active" : ""}`}
                  aria-pressed={onlyFavorites}
                  onClick={() => setOnlyFavorites((value) => !value)}
                >
                  <Star size={15} aria-hidden="true" fill={onlyFavorites ? "currentColor" : "none"} />
                  즐겨찾기 {favoriteCount}
                </button>
                <div className="sortBox">
                  <label htmlFor="sort">정렬</label>
                  <select id="sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="button small" onClick={resetFilters} disabled={!filtersActive}>
                  <RotateCcw size={15} aria-hidden="true" />
                  초기화
                </button>
              </div>
            </div>
          </section>
        )}

        {state.status === "loading" && (
          <p className="notice" role="status">
            정보를 불러오는 중입니다…
          </p>
        )}

        {state.status === "error" && (
          <div className="notice error" role="alert">
            <TriangleAlert size={28} aria-hidden="true" />
            <p>정보를 불러오지 못했습니다.</p>
            <p className="detail">{state.message}</p>
            <button type="button" className="button primary" onClick={() => setAttempt((n) => n + 1)}>
              <RotateCcw size={16} aria-hidden="true" />
              다시 시도
            </button>
          </div>
        )}

        {places && visible.length === 0 && (
          <div className="notice empty">
            <SearchX size={28} aria-hidden="true" />
            <p>{onlyFavorites && !query && !category ? "즐겨찾기한 항목이 없습니다." : "조건에 맞는 항목이 없습니다."}</p>
            <button type="button" className="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              필터 초기화
            </button>
          </div>
        )}

        {showMap && (
          <PlaceMap places={visible} favoriteIds={favoriteIds} onOpen={openPlace} onToggleFavorite={toggle} />
        )}

        {!showMap && visible.length > 0 && (
          <ul className="grid">
            {visible.map((place) => (
              <li key={place.id}>
                <PlaceCard
                  place={place}
                  favorite={favoriteIds.has(place.id)}
                  onOpen={openPlace}
                  onToggleFavorite={toggle}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="siteFoot">
        학생들이 제출한 정보를 정리한 것으로, 운영시간과 가격은 바뀔 수 있습니다. 방문 전 확인하세요.
      </footer>

      {selected && (
        <PlaceDialog
          place={selected}
          favorite={favoriteIds.has(selected.id)}
          onClose={closePlace}
          onToggleFavorite={toggle}
        />
      )}
    </div>
  );
}

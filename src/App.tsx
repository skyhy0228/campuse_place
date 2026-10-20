import { ListFilter, MapPin, RotateCcw, Search, SearchX, Star, TriangleAlert, UserRound, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AccountDialog } from "./components/AccountDialog";
import { AuthDialog } from "./components/AuthDialog";
import { PlaceCard } from "./components/PlaceCard";
import { PlaceDialog } from "./components/PlaceDialog";
import { PopularStrip } from "./components/PopularStrip";
import { ThemeToggle } from "./components/ThemeToggle";
import { openStatus } from "./lib/hours";
import { buildCategories, filterPlaces, loadPlaces, type PlaceView } from "./lib/places";
import { newPlaceUrl } from "./lib/report";
import { SessionProvider, useSession } from "./lib/session";
import { filtersFromSearch, filtersToSearch } from "./lib/urlState";
import { DEFAULT_FILTERS, type Campus, type Filters, type PriceBand, type SortKey } from "./types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; places: PlaceView[] };

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommendations", label: "추천수 높은 순" },
  { value: "name", label: "이름순" },
  { value: "checked", label: "확인한날 최신순" },
];
const CAMPUS_OPTIONS: { value: Campus; label: string }[] = [
  { value: "", label: "전체" },
  { value: "in", label: "교내" },
  { value: "out", label: "교외" },
];
const PRICE_OPTIONS: { value: PriceBand; label: string }[] = [
  { value: "", label: "전체" },
  { value: "free", label: "무료" },
  { value: "under10", label: "1만원 미만" },
  { value: "10to20", label: "1~2만원" },
  { value: "over20", label: "2만원 이상" },
];

const parseHash = () => {
  const match = location.hash.match(/^#place=([\w-]+)$/);
  return match ? match[1] : null;
};

function Main() {
  const session = useSession();
  const { favoriteIds, collections } = session;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(location.search));
  const [filterPanelOpen, setFilterPanelOpen] = useState(() => {
    const f = filtersFromSearch(location.search);
    return f.openNow || Boolean(f.campus) || Boolean(f.price);
  });
  const [selectedId, setSelectedId] = useState<string | null>(parseHash);
  const [now, setNow] = useState(() => new Date());
  const deferredQuery = useDeferredValue(filters.query);
  const patch = useCallback((change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change })), []);

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

  // '영업 중' 표시가 오래된 값으로 남지 않게 1분마다 시각을 갱신한다.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // 검색·필터 상태를 주소에 반영해 같은 화면을 링크로 공유할 수 있게 한다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = filtersToSearch(filters);
      if (search !== location.search) history.replaceState(history.state, "", location.pathname + search + location.hash);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

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

  // 로그아웃했거나 삭제된 목록을 가리키는 필터는 해제한다.
  useEffect(() => {
    if (filters.list.startsWith("c:") && !collections.some((c) => `c:${c.id}` === filters.list)) patch({ list: "" });
  }, [filters.list, collections, patch]);

  const places = state.status === "ready" ? state.places : null;
  const categories = useMemo(() => (places ? buildCategories(places) : []), [places]);

  const listIds = useMemo(() => {
    if (filters.list === "fav") return favoriteIds;
    const collection = collections.find((c) => `c:${c.id}` === filters.list);
    return collection ? new Set(collection.placeIds) : null;
  }, [filters.list, favoriteIds, collections]);

  const visible = useMemo(
    () => (places ? filterPlaces(places, { ...filters, query: deferredQuery }, listIds, now) : []),
    [places, filters, deferredQuery, listIds, now],
  );

  const advancedCount = (filters.openNow ? 1 : 0) + (filters.campus ? 1 : 0) + (filters.price ? 1 : 0);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const popular = useMemo(
    () =>
      places
        ? [...places]
            .filter((p) => p.recommendations >= 2)
            .sort((a, b) => b.recommendations - a.recommendations || a.name.localeCompare(b.name, "ko"))
            .slice(0, 8)
        : [],
    [places],
  );
  const selected = places?.find((place) => place.id === selectedId) ?? null;
  const favoriteCount = places ? places.filter((p) => favoriteIds.has(p.id)).length : 0;
  const openableCount = places ? places.filter((p) => openStatus(p.schedule, now) !== "unknown").length : 0;

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="app">
      <a className="skipLink" href="#main">
        본문 바로가기
      </a>
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

          <div className="headerActions">
            <ThemeToggle />
            <button
              type="button"
              className="button small account"
              onClick={() => (session.user ? session.openAccount() : session.openAuth("login"))}
              aria-label={session.user ? `내 계정 (${session.user.username})` : "로그인"}
            >
              <UserRound size={16} aria-hidden="true" />
              <span className="accountName">{session.user ? session.user.username : "로그인"}</span>
            </button>
          </div>

          <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="search" className="srOnly">
              통합 검색
            </label>
            <Search size={18} className="searchIcon" aria-hidden="true" />
            <input
              id="search"
              type="search"
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="장소, 메뉴, 위치, 팁 검색 (초성도 가능: ㄱㅌㄷ)"
              autoComplete="off"
              enterKeyHint="search"
            />
            {filters.query && (
              <button type="button" className="clear" onClick={() => patch({ query: "" })} aria-label="검색어 지우기">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </form>
        </div>
      </header>

      <main className="main" id="main" tabIndex={-1}>
        {places && (
          <section className="controls" aria-label="필터와 정렬">
            <div className="chipRow" role="group" aria-label="분류">
              <button type="button" className="chip" aria-pressed={!filters.category} onClick={() => patch({ category: "" })}>
                전체 <span className="count">{places.length}</span>
              </button>
              {categories.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="chip"
                  data-category={option.value}
                  aria-pressed={filters.category === option.value}
                  onClick={() => patch({ category: filters.category === option.value ? "" : option.value })}
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
                <button
                  type="button"
                  className={`button small${filters.list === "fav" ? " active" : ""}`}
                  aria-pressed={filters.list === "fav"}
                  onClick={() => patch({ list: filters.list === "fav" ? "" : "fav" })}
                >
                  <Star size={15} aria-hidden="true" fill={filters.list === "fav" ? "currentColor" : "none"} />
                  즐겨찾기 {favoriteCount}
                </button>
                {collections.length > 0 && (
                  <div className="sortBox">
                    <label htmlFor="list">내 목록</label>
                    <select id="list" value={filters.list.startsWith("c:") ? filters.list : ""} onChange={(e) => patch({ list: e.target.value })}>
                      <option value="">선택 안 함</option>
                      {collections.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>
                          {c.name} ({c.placeIds.length})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  className={`button small${advancedCount ? " active" : ""}`}
                  aria-expanded={filterPanelOpen}
                  aria-controls="filterPanel"
                  onClick={() => setFilterPanelOpen((v) => !v)}
                >
                  <ListFilter size={15} aria-hidden="true" />
                  필터{advancedCount ? ` ${advancedCount}` : ""}
                </button>
                <div className="sortBox">
                  <label htmlFor="sort">정렬</label>
                  <select id="sort" value={filters.sort} onChange={(event) => patch({ sort: event.target.value as SortKey })}>
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

            {filterPanelOpen && (
              <div id="filterPanel" className="filterPanel" role="group" aria-label="추가 필터">
                <div className="filterItem">
                  <button type="button" className="chip" aria-pressed={filters.openNow} onClick={() => patch({ openNow: !filters.openNow })}>
                    지금 영업 중
                  </button>
                  <p className="hint">운영시간의 요일과 시간이 분명한 {openableCount}곳만 판단합니다. 한국 시간 기준이며 실제와 다를 수 있습니다.</p>
                </div>
                <fieldset className="filterItem">
                  <legend>위치</legend>
                  <div className="segmented">
                    {CAMPUS_OPTIONS.map((o) => (
                      <button key={o.value} type="button" aria-pressed={filters.campus === o.value} onClick={() => patch({ campus: o.value })}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="filterItem">
                  <label htmlFor="price">가격 (표기된 최저가 기준)</label>
                  <select id="price" value={filters.price} onChange={(e) => patch({ price: e.target.value as PriceBand })}>
                    {PRICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>
        )}

        {places && !filtersActive && <PopularStrip places={popular} onOpen={openPlace} />}

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
            <p>
              {filters.list === "fav" && !filters.query && !filters.category && !advancedCount
                ? "즐겨찾기한 항목이 없습니다."
                : "조건에 맞는 항목이 없습니다."}
            </p>
            <button type="button" className="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              필터 초기화
            </button>
          </div>
        )}

        {visible.length > 0 && (
          <>
            <h2 className={filtersActive ? "srOnly" : "listTitle"}>{filtersActive ? "검색 결과" : "전체 장소"}</h2>
            <ul className="grid">
              {visible.map((place) => (
                <li key={place.id}>
                  <PlaceCard
                    place={place}
                    favorite={favoriteIds.has(place.id)}
                    open={openStatus(place.schedule, now) === "open"}
                    onOpen={openPlace}
                    onToggleFavorite={session.toggleFavorite}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <footer className="siteFoot">
        <p>학생들이 제출한 정보를 정리한 것으로, 운영시간과 가격은 바뀔 수 있습니다. 방문 전 확인하세요.</p>
        <p>
          목록에 없는 곳을 알고 계신가요?{" "}
          <a href={newPlaceUrl} target="_blank" rel="noopener noreferrer">
            새 장소·꿀팁 제보하기
          </a>{" "}
          (GitHub 계정이 필요하며, 제보 내용은 공개됩니다. 개인정보는 적지 마세요.)
        </p>
      </footer>

      {selected && (
        <PlaceDialog
          place={selected}
          favorite={favoriteIds.has(selected.id)}
          open={openStatus(selected.schedule, now) === "open"}
          onClose={closePlace}
          onToggleFavorite={session.toggleFavorite}
        />
      )}
      <AuthDialog />
      <AccountDialog />
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Main />
    </SessionProvider>
  );
}

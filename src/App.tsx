import { Map as MapIcon, MapPin, MapPinPlus, RotateCcw, School, Search, SearchX, TriangleAlert, UserRound, House, X } from "lucide-react";
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AccountDialog } from "./components/AccountDialog";
import { AuthDialog } from "./components/AuthDialog";
import { BusDialog, nextBusSummary } from "./components/BusDialog";
import { CafeteriaDialog } from "./components/CafeteriaDialog";
import { CloudAuthDialog } from "./components/CloudAuthDialog";
import { Controls } from "./components/Controls";
import { HomeTiles } from "./components/HomeTiles";
import { LangToggle } from "./components/LangToggle";
import { PlaceCard } from "./components/PlaceCard";
import { PlaceDialog } from "./components/PlaceDialog";
import { PlaceMap } from "./components/PlaceMap";
import { PopularStrip } from "./components/PopularStrip";
import { QuickBar } from "./components/QuickBar";
import { RandomPick } from "./components/RandomPick";
import { RoomFinder } from "./components/RoomFinder";
import { SharedListBanner } from "./components/SharedListBanner";
import { SideList } from "./components/SideList";
import { SubmitDialog, type SubmitTarget } from "./components/SubmitDialog";
import { TabBar } from "./components/TabBar";
import { ThemeToggle } from "./components/ThemeToggle";
import { aliasTable, parseRoomQuery } from "./lib/campus";
import { useCampusData } from "./lib/campusData";
import { kstDateString, weekRange } from "./lib/dates";
import { openStatus } from "./lib/hours";
import { LangProvider, useLang } from "./lib/i18n";
import { isLocated, mapEnabled } from "./lib/kakaoMap";
import { SCHOOL, formatDistance, type LatLng } from "./lib/nearby";
import type { Override } from "./lib/overrides";
import {
  applyConfirms,
  applyOverrides,
  applyRatings,
  buildCategories,
  distancesFrom,
  filterPlaces,
  isIntl,
  isPlaceStale,
  loadPlaces,
  matchesQuery,
  passesFilters,
  toView,
  type ConfirmStats,
  type PlaceView,
  type RatingStats,
} from "./lib/places";
import {
  getConfirmStats,
  getPlaceOverrides,
  getRatingStats,
  listApprovedPlaces,
  listBusTimes,
  listMenus,
  trackView,
  type BusTime,
  type CafeteriaMenu,
} from "./lib/remote";
import { newPlaceUrl } from "./lib/report";
import { SessionProvider, useSession } from "./lib/session";
import { shareLink, siteBase } from "./lib/share";
import { sharedListFromParams, sharedListUrl, type SharedList } from "./lib/shareList";
import { submissionToPlace } from "./lib/submissionPlace";
import { supabaseEnabled } from "./lib/supabase";
import { filtersFromSearch, filtersToSearch, viewFromSearch, type View } from "./lib/urlState";
import { useGlassSheen } from "./lib/useGlassSheen";
import { DEFAULT_FILTERS, type Filters } from "./types";

// 캠퍼스 지도(Leaflet)와 관리자 화면은 열 때 따로 불러온다.
const CampusMap = lazy(() => import("./components/CampusMap").then((m) => ({ default: m.CampusMap })));
const AdminPage = lazy(() => import("./components/AdminPage"));

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; places: PlaceView[] };
type Panel = "pick" | "cafeteria" | "bus" | null;

const FOOD_CATEGORIES = ["", "식당", "카페"];
const VIEWED_KEY = "campuse:viewed";

const parseHash = () => {
  const match = location.hash.match(/^#place=([\w-]+)$/);
  return match ? match[1] : null;
};

// 같은 화면(탭)에서 같은 장소의 조회수는 한 번만 센다.
function countViewOnce(id: string) {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? "[]"));
    if (seen.has(id)) return;
    seen.add(id);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    // 저장소를 쓸 수 없으면 세지 않는다.
    return;
  }
  trackView(id).catch(() => undefined);
}

function Main() {
  const session = useSession();
  const { lang, t } = useLang();
  const { favoriteIds, collections } = session;
  useGlassSheen();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [reported, setReported] = useState<PlaceView[]>([]);
  const [stats, setStats] = useState<RatingStats>(() => new Map());
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [confirms, setConfirms] = useState<ConfirmStats>(() => new Map());
  const [menus, setMenus] = useState<CafeteriaMenu[]>([]);
  const [buses, setBuses] = useState<BusTime[]>([]);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(location.search));
  const [shared, setShared] = useState<SharedList | null>(() => sharedListFromParams(new URLSearchParams(location.search)));
  const [filterPanelOpen, setFilterPanelOpen] = useState(() => {
    const f = filtersFromSearch(location.search);
    return f.openNow || Boolean(f.campus) || Boolean(f.price) || f.intl;
  });
  const [view, setView] = useState<View>(() => viewFromSearch(location.search));
  const [selectedId, setSelectedId] = useState<string | null>(parseHash);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [submitTarget, setSubmitTarget] = useState<SubmitTarget | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [now, setNow] = useState(() => new Date());
  // 가까운 순: 기본은 학교 기준. 사용자가 누를 때만 위치를 묻는다.
  const [origin, setOrigin] = useState<{ kind: "school" | "me"; pos: LatLng }>({ kind: "school", pos: SCHOOL });
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
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

  // Supabase: 승인된 학생 제보·정보 수정, 회원 별점, '아직 맞아요', 학식·버스. 실패해도 기본 데이터로 계속 쓴다.
  const refreshRatings = useCallback(() => {
    if (!supabaseEnabled) return;
    getRatingStats()
      .then(setStats)
      .catch(() => undefined);
  }, []);
  const refreshConfirms = useCallback(() => {
    if (!supabaseEnabled) return;
    getConfirmStats()
      .then(setConfirms)
      .catch(() => undefined);
  }, []);
  const refreshReports = useCallback(() => {
    if (!supabaseEnabled) return;
    listApprovedPlaces()
      .then((rows) => setReported(rows.map((row) => toView(submissionToPlace(row), "9999"))))
      .catch(() => undefined);
    getPlaceOverrides()
      .then(setOverrides)
      .catch(() => undefined);
  }, []);
  const refreshInfo = useCallback(() => {
    if (!supabaseEnabled) return;
    const { start, end } = weekRange(kstDateString(new Date()));
    listMenus(start, end)
      .then(setMenus)
      .catch(() => undefined);
    listBusTimes()
      .then(setBuses)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    refreshRatings();
    refreshConfirms();
    refreshReports();
    refreshInfo();
  }, [refreshRatings, refreshConfirms, refreshReports, refreshInfo]);

  // '영업 중' 표시가 오래된 값으로 남지 않게 1분마다 시각을 갱신한다.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // 검색·필터 상태를 주소에 반영해 같은 화면을 링크로 공유할 수 있게 한다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = filtersToSearch(filters, view, shared);
      if (search !== location.search) history.replaceState(history.state, "", location.pathname + search + location.hash);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters, view, shared]);

  useEffect(() => {
    document.title = view === "admin" ? `${t.admin} · ${t.siteTitle}` : t.siteTitle;
  }, [t, view]);

  useEffect(() => {
    const sync = () => setSelectedId(parseHash());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    if (supabaseEnabled && selectedId) countViewOnce(selectedId);
  }, [selectedId]);

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

  const changeView = useCallback((next: View) => {
    setView(next);
    setFocusId(null);
    window.scrollTo({ top: 0 });
  }, []);

  // 로그아웃했거나 삭제된 목록, 사라진 공유 목록을 가리키는 필터는 해제한다.
  useEffect(() => {
    if (filters.list.startsWith("c:") && !collections.some((c) => `c:${c.id}` === filters.list)) patch({ list: "" });
    if (filters.list === "shared" && !shared) patch({ list: "" });
  }, [filters.list, collections, shared, patch]);

  // 운영자가 폐업을 확인한 곳(closed)은 목록·지도에서 빼고, 링크로 열 때만 보여준다.
  const allPlaces = useMemo(
    () =>
      state.status === "ready" ? applyConfirms(applyRatings(applyOverrides([...state.places, ...reported], overrides), stats), confirms) : null,
    [state, reported, overrides, stats, confirms],
  );
  const places = useMemo(() => allPlaces?.filter((p) => !p.closed) ?? null, [allPlaces]);
  const categories = useMemo(() => (places ? buildCategories(places) : []), [places]);

  const listIds = useMemo(() => {
    if (filters.list === "fav") return favoriteIds;
    if (filters.list === "shared") return shared ? new Set(shared.ids) : null;
    const collection = collections.find((c) => `c:${c.id}` === filters.list);
    return collection ? new Set(collection.placeIds) : null;
  }, [filters.list, favoriteIds, collections, shared]);

  const distances = useMemo(() => (places && filters.sort === "near" ? distancesFrom(places, origin.pos) : null), [places, filters.sort, origin]);

  const visible = useMemo(
    () => (places ? filterPlaces(places, { ...filters, query: deferredQuery }, listIds, now, distances) : []),
    [places, filters, deferredQuery, listIds, now, distances],
  );

  // 음식 칩 개수: 음식 종류를 뺀 나머지 조건으로 센다.
  const foodCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!places) return counts;
    for (const place of places) {
      if (!place.foodType || !FOOD_CATEGORIES.includes(place.category)) continue;
      if (!passesFilters(place, { ...filters, query: deferredQuery }, listIds, now) || !matchesQuery(place, deferredQuery)) continue;
      counts.set(place.foodType, (counts.get(place.foodType) ?? 0) + 1);
    }
    return counts;
  }, [places, filters, deferredQuery, listIds, now]);

  const campus = useCampusData(view === "campus" || filters.query.trim().length >= 2);
  const aliases = useMemo(() => (campus.data ? aliasTable(campus.data) : []), [campus.data]);
  const room = useMemo(
    () => (campus.data && deferredQuery.trim() ? parseRoomQuery(deferredQuery, campus.data, aliases) : null),
    [campus.data, deferredQuery, aliases],
  );

  // 캠퍼스 지도에서 강의실을 찾으면 검색어로 장소를 거르지 않고, 다른 조건에 맞는 핀을 그대로 보여준다.
  const campusPlaces = useMemo(
    () => (room && places ? filterPlaces(places, { ...filters, query: "" }, listIds, now) : visible),
    [room, places, filters, listIds, now, visible],
  );
  const roomOnCampus = view === "campus" && Boolean(room);

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
  // 키가 있고 좌표가 있는 장소가 하나라도 있을 때만 지도 보기를 제공한다.
  const canShowMap = mapEnabled && Boolean(places?.some(isLocated));
  const currentView: View = view === "map" && !canShowMap ? "list" : view === "admin" && !supabaseEnabled ? "list" : view;
  const selected = allPlaces?.find((place) => place.id === selectedId) ?? null;
  const favoriteCount = places ? places.filter((p) => favoriteIds.has(p.id)).length : 0;
  const openableCount = places ? places.filter((p) => openStatus(p.schedule, now) !== "unknown").length : 0;
  const tileCounts = useMemo(
    () => ({
      food: places?.filter((p) => p.category === "식당").length ?? 0,
      cafe: places?.filter((p) => p.category === "카페").length ?? 0,
      pub: places?.filter((p) => p.foodType === "pub").length ?? 0,
    }),
    [places],
  );
  const sharedFound = useMemo(() => (shared && places ? places.filter((p) => shared.ids.includes(p.id)).length : 0), [shared, places]);

  // 학식·버스 바로 가기: 입력된 내용이 있거나 운영자일 때만 보여준다.
  const today = kstDateString(now);
  const todayMenus = menus.filter((m) => m.served_on === today);
  const nextBus = useMemo(() => nextBusSummary(buses, now), [buses, now]);
  const showCafeteria = supabaseEnabled && (menus.length > 0 || session.isAdmin);
  const showBus = supabaseEnabled && (buses.length > 0 || session.isAdmin);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setShared(null);
  };
  const accountLabel = session.user ? t.myAccount(session.user.username) : t.login;
  const openAccount = () => (session.user ? session.openAccount() : session.openAuth("login"));

  // 장소 제보: Supabase 가 있으면 제보 창, 없으면 GitHub 이슈 양식
  const addPlace = () => {
    if (supabaseEnabled) setSubmitTarget({ kind: "new" });
    else window.open(newPlaceUrl, "_blank", "noopener,noreferrer");
  };

  // 상세에서 '지도에서 보기': 상세를 닫고 그 장소가 보이게 지도로 간다.
  const showOn = (next: View) => (id: string) => {
    closePlace();
    setView(next);
    setFocusId(id);
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setLocateError(t.nearUnavailable);
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ kind: "me", pos: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError(t.nearDenied);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const shareSelectedList = async () => {
    const collection = collections.find((c) => `c:${c.id}` === filters.list);
    if (!collection || !collection.placeIds.length) return;
    const result = await shareLink(sharedListUrl(siteBase(), { name: collection.name, ids: collection.placeIds }), collection.name, t.copyPrompt);
    if (result === "copied") {
      setShareStatus(t.shareListCopied);
      window.setTimeout(() => setShareStatus(""), 2500);
    }
  };

  const goAdmin = () => {
    setPanel(null);
    changeView("admin");
  };

  const navItems: { view: View; label: string; icon: typeof House; show: boolean }[] = [
    { view: "list", label: t.navHome, icon: House, show: true },
    { view: "map", label: t.navMap, icon: MapIcon, show: canShowMap },
    { view: "campus", label: t.navCampus, icon: School, show: true },
  ];

  return (
    <div className="app" data-view={currentView}>
      <div className="sky" aria-hidden="true">
        <span />
        <span />
      </div>
      <a className="skipLink" href="#main">
        {t.skip}
      </a>

      <aside className="side" aria-label={t.siteTitle}>
        <header className="sideHead">
          <div className="brand">
            <span className="brandMark" aria-hidden="true">
              <MapPin size={20} />
            </span>
            <div>
              <h1>{t.siteTitle}</h1>
              <p>{t.siteSub}</p>
            </div>
          </div>
          <div className="headerActions">
            <LangToggle />
            <ThemeToggle />
            <button type="button" className="iconButton account" onClick={openAccount} aria-label={accountLabel} title={accountLabel}>
              <UserRound size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className="sideNav segmented full" aria-label={t.navLabel}>
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <button key={item.view} type="button" aria-current={currentView === item.view ? "page" : undefined} onClick={() => changeView(item.view)}>
                {item.label}
              </button>
            ))}
        </nav>

        <form className="search glass" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="search" className="srOnly">
            {t.searchLabel}
          </label>
          <Search size={18} className="searchIcon" aria-hidden="true" />
          <input
            id="search"
            type="search"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder={t.searchPh}
            autoComplete="off"
            enterKeyHint="search"
          />
          {filters.query && (
            <button type="button" className="clear" onClick={() => patch({ query: "" })} aria-label={t.clearSearch}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </form>

        {campus.data && deferredQuery.trim() && currentView !== "campus" && (
          <RoomFinder data={campus.data} query={deferredQuery} room={room} onShowCampus={() => changeView("campus")} />
        )}

        {places && currentView !== "admin" && (
          <Controls
            total={places.length}
            visibleCount={visible.length}
            categories={categories}
            foodCounts={foodCounts}
            filters={filters}
            patch={patch}
            onReset={resetFilters}
            filtersActive={filtersActive}
            favoriteCount={favoriteCount}
            collections={collections}
            panelOpen={filterPanelOpen}
            onTogglePanel={() => setFilterPanelOpen((v) => !v)}
            openableCount={openableCount}
            hasZones={places.some((p) => p.zone)}
            hasIntl={places.some(isIntl)}
            near={{
              origin: origin.kind,
              locating,
              error: locateError,
              unknown: distances ? visible.filter((p) => !distances.has(p.id)).length : 0,
              onUseMe: locateMe,
              onUseSchool: () => {
                setOrigin({ kind: "school", pos: SCHOOL });
                setLocateError("");
              },
            }}
            onShareList={() => void shareSelectedList()}
            shareStatus={shareStatus}
          />
        )}

        {places && (currentView === "map" || currentView === "campus") && <SideList places={visible} onOpen={openPlace} />}
      </aside>

      <main className="main" id="main" tabIndex={-1}>
        {state.status === "loading" && (
          <p className="notice" role="status">
            {t.loading}
          </p>
        )}

        {state.status === "error" && (
          <div className="notice error" role="alert">
            <TriangleAlert size={28} aria-hidden="true" />
            <p>{t.loadError}</p>
            <p className="detail">{state.message}</p>
            <button type="button" className="button primary" onClick={() => setAttempt((n) => n + 1)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t.retry}
            </button>
          </div>
        )}

        {places && currentView !== "admin" && filters.list === "shared" && shared && (
          <SharedListBanner
            list={shared}
            found={sharedFound}
            onClose={() => {
              setShared(null);
              patch({ list: "" });
            }}
          />
        )}

        {places && currentView === "list" && !filters.query && !filters.list && (
          <QuickBar
            onPick={() => setPanel("pick")}
            onAddPlace={addPlace}
            onCafeteria={showCafeteria ? () => setPanel("cafeteria") : undefined}
            onBus={showBus ? () => setPanel("bus") : undefined}
            cafeteriaHint={todayMenus.length ? [...new Set(todayMenus.map((m) => m.cafeteria))].join(" · ") : undefined}
            busHint={nextBus ? `${nextBus.time} · ${nextBus.line}` : undefined}
          />
        )}
        {places && currentView === "list" && !filters.query && !filters.list && <HomeTiles counts={tileCounts} filters={filters} patch={patch} />}
        {places && currentView === "list" && !filtersActive && <PopularStrip places={popular} onOpen={openPlace} />}

        {places && currentView !== "admin" && visible.length === 0 && !roomOnCampus && (
          <div className="notice empty">
            <SearchX size={28} aria-hidden="true" />
            <p>{filters.list === "fav" && !filters.query && !filters.category ? t.emptyFav : t.empty}</p>
            <div className="buttonRow">
              <button type="button" className="button" onClick={resetFilters}>
                <RotateCcw size={16} aria-hidden="true" />
                {t.resetFilters}
              </button>
              {/* 찾는 곳이 없을 때가 목록에 없는 장소를 알려 주기 좋은 때다. */}
              {filters.query && (
                <button type="button" className="button" onClick={addPlace}>
                  <MapPinPlus size={16} aria-hidden="true" />
                  {t.addPlace}
                </button>
              )}
            </div>
          </div>
        )}

        {currentView === "map" && places && visible.length > 0 && (
          <PlaceMap
            places={visible}
            favoriteIds={favoriteIds}
            focusId={focusId}
            onOpen={openPlace}
            onToggleFavorite={session.toggleFavorite}
            onShowList={() => changeView("list")}
          />
        )}

        {currentView === "campus" && places && (
          <Suspense fallback={<p className="notice">{t.loading}</p>}>
            {campus.data ? (
              <CampusMap data={campus.data} places={campusPlaces} room={room} focusId={focusId} onOpen={openPlace} />
            ) : campus.error ? (
              <p className="notice error" role="alert">
                {campus.error}
              </p>
            ) : (
              <p className="notice">{t.loading}</p>
            )}
          </Suspense>
        )}

        {currentView === "admin" && allPlaces && (
          <Suspense fallback={<p className="notice">{t.loading}</p>}>
            <AdminPage places={allPlaces} onDataChanged={refreshInfo} onPlacesChanged={refreshReports} />
          </Suspense>
        )}

        {currentView === "list" && visible.length > 0 && (
          <>
            <h2 className={filtersActive ? "srOnly" : "listTitle"}>{filtersActive ? t.results : t.allPlaces}</h2>
            <ul className="grid">
              {visible.map((place) => {
                const meters = distances?.get(place.id);
                return (
                  <li key={place.id}>
                    <PlaceCard
                      place={place}
                      favorite={favoriteIds.has(place.id)}
                      open={openStatus(place.schedule, now) === "open"}
                      onOpen={openPlace}
                      onToggleFavorite={session.toggleFavorite}
                      showChecked={filters.sort === "checked"}
                      stale={isPlaceStale(place, now)}
                      distance={
                        meters === undefined ? undefined : { text: formatDistance(meters), label: t.nearDistance(formatDistance(meters), origin.kind === "me") }
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <footer className="siteFoot">
          <p>{t.footNote}</p>
          <p>
            {t.footReport}{" "}
            {supabaseEnabled ? (
              <>
                <button type="button" className="linkButton" onClick={() => setSubmitTarget({ kind: "new" })}>
                  {t.footReportLink}
                </button>{" "}
                {t.footReportMember}
              </>
            ) : (
              <>
                <a href={newPlaceUrl} target="_blank" rel="noopener noreferrer">
                  {t.footReportLink}
                </a>{" "}
                {t.footReportGithub}
              </>
            )}
          </p>
          <p>
            {t.footCredits}: {t.footCreditsBody}
          </p>
          <p>{t.footOsm}</p>
        </footer>
      </main>

      <TabBar
        view={currentView}
        canShowMap={canShowMap}
        favoritesOn={filters.list === "fav"}
        onView={changeView}
        onFavorites={() => {
          patch({ list: filters.list === "fav" ? "" : "fav" });
          if (currentView !== "list") changeView("list");
        }}
        onAccount={openAccount}
        accountLabel={accountLabel}
      />

      {selected && (
        <PlaceDialog
          key={`${selected.id}-${lang}`}
          place={selected}
          favorite={favoriteIds.has(selected.id)}
          open={openStatus(selected.schedule, now) === "open"}
          onClose={closePlace}
          onToggleFavorite={session.toggleFavorite}
          onShowMap={canShowMap && !selected.closed ? showOn("map") : undefined}
          onShowCampus={selected.closed ? undefined : showOn("campus")}
          onReport={
            supabaseEnabled
              ? (place) =>
                  setSubmitTarget({
                    kind: "fix",
                    placeId: place.id,
                    name: place.name,
                    category: place.category,
                    current: { hours: place.hours, closedDays: place.closedDays, price: place.price, menu: place.menu, location: place.location },
                  })
              : undefined
          }
          onRatingsChanged={refreshRatings}
          onConfirmed={refreshConfirms}
        />
      )}
      {panel === "pick" && places && (
        <RandomPick
          places={places}
          favoriteIds={favoriteIds}
          now={now}
          onClose={() => setPanel(null)}
          onOpen={(id) => {
            setPanel(null);
            openPlace(id);
          }}
        />
      )}
      {panel === "cafeteria" && <CafeteriaDialog menus={menus} today={today} onClose={() => setPanel(null)} onManage={session.isAdmin ? goAdmin : undefined} />}
      {panel === "bus" && <BusDialog buses={buses} now={now} onClose={() => setPanel(null)} onManage={session.isAdmin ? goAdmin : undefined} />}
      {session.backend === "cloud" ? <CloudAuthDialog /> : <AuthDialog />}
      <AccountDialog
        onAdmin={() => {
          session.closeAccount();
          changeView("admin");
        }}
      />
      {submitTarget && <SubmitDialog target={submitTarget} onClose={() => setSubmitTarget(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <SessionProvider>
        <Main />
      </SessionProvider>
    </LangProvider>
  );
}

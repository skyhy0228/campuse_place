// 캠퍼스 지도 (ut 꿀팁 지도 팀원 작업): OSM 으로 그린 SVG 위에 건물 라벨, 장소 핀, 버스 정류장, 학생 추천 동선을 올린다.
// Leaflet 의 CRS.Simple 을 써서 SVG 의 m 단위 좌표를 그대로 쓴다. (위도·경도가 아님)
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Footprints, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildingName, floorHas, type CampusData, type RoomQuery } from "../lib/campus";
import { useLang } from "../lib/i18n";
import { assetUrl, placeText, type PlaceView } from "../lib/places";
import { CATEGORY_PIN_COLORS } from "./categoryIcon";

type CampusPlace = PlaceView & { campusXY: NonNullable<PlaceView["campusXY"]> };

interface Props {
  data: CampusData;
  places: PlaceView[];
  room: RoomQuery | null;
  focusId: string | null;
  onOpen: (id: string) => void;
}

const EMOJI: Record<string, string> = {
  식당: "🍚",
  카페: "☕",
  학교시설: "🏫",
  숨은장소: "✨",
  생활꿀팁: "💡",
  유학생: "🌏",
  관광지: "🌸",
  자유: "💬",
  제보: "📣",
};

interface Group {
  key: string;
  x: number;
  y: number;
  building?: string;
  places: CampusPlace[];
}

// 같은 건물은 한 핀으로, 건물이 없으면 약 4m 격자로 묶는다.
function groupPlaces(places: PlaceView[], data: CampusData): Group[] {
  const groups = new Map<string, Group>();
  const buildings = new Map(data.buildings.map((b) => [b.code, b]));
  for (const place of places) {
    const pos = place.campusXY;
    if (!pos) continue;
    const b = pos.building ? buildings.get(pos.building) : undefined;
    const key = b ? `b:${b.code}` : `${Math.round(pos.x / 4)}:${Math.round(pos.y / 4)}`;
    const group = groups.get(key) ?? { key, x: b?.x ?? pos.x, y: b?.y ?? pos.y, building: b?.code, places: [] };
    group.places.push(place as CampusPlace);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function majorityCategory(places: PlaceView[]) {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

type Panel = { kind: "building"; code: string } | { kind: "group"; key: string } | null;

export function CampusMap({ data, places, room, focusId, onOpen }: Props) {
  const { lang, t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const homeZoom = useRef(0);
  const layers = useRef<{ markers: L.LayerGroup; route: L.LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [routeId, setRouteId] = useState<string | null>(null);

  const H = data.size.h;
  const ll = (x: number, y: number): L.LatLngTuple => [H - y, x];

  const groups = useMemo(() => groupPlaces(places, data), [places, data]);
  const pinned = groups.reduce((sum, g) => sum + g.places.length, 0);

  // 지도는 한 번만 만든다.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2.5,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBoundsViscosity: 0.8,
      attributionControl: true,
    });
    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [H, data.size.w],
    ];
    L.imageOverlay(assetUrl("campus/campus.svg"), bounds, { interactive: false, alt: "" }).addTo(map);
    map.setMaxBounds([
      [-200, -200],
      [H + 200, data.size.w + 200],
    ]);
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL)');

    const home = L.latLngBounds(data.buildings.map((b) => ll(b.x, b.y))).pad(0.08);
    map.fitBounds(home);
    homeZoom.current = map.getZoom();

    // 건물 라벨: 멀리서는 번호만, 더 멀면 숨긴다.
    const labelLayer = L.layerGroup().addTo(map);
    for (const b of data.buildings) {
      const marker = L.marker(ll(b.x, b.y), {
        icon: L.divIcon({ className: "", html: `<div class="blabel"><b>${b.code}</b><span class="bn">${escapeHtml(b.name)}</span></div>`, iconSize: [80, 30], iconAnchor: [40, -6] }),
        zIndexOffset: -500,
        keyboard: false,
        title: `${b.code} ${b.name}`,
      });
      marker.on("click", () => setPanel({ kind: "building", code: b.code }));
      marker.addTo(labelLayer);
    }
    const busLayer = L.layerGroup().addTo(map);
    for (const s of data.busStops) {
      L.marker(ll(s.x, s.y), {
        icon: L.divIcon({ className: "", html: '<span class="cbus" aria-hidden="true">🚏</span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        keyboard: false,
        interactive: true,
        title: `${t.busStop}: ${s.name}`,
      })
        .bindTooltip(s.name, { direction: "top" })
        .addTo(busLayer);
    }
    const zoomClass = () => {
      const z = map.getZoom();
      container.classList.toggle("zFar", z < homeZoom.current + 0.5);
      container.classList.toggle("zFar2", z < homeZoom.current - 0.5);
    };
    map.on("zoomend", zoomClass);
    zoomClass();

    layers.current = { markers: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map) };
    map.on("click", () => setPanel(null));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    mapRef.current = map;
    setReady(true);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layers.current = null;
      setReady(false);
    };
    // 지도는 데이터가 바뀌지 않는 한 다시 만들지 않는다.
  }, [data]);

  // 장소 핀
  const selectedBuilding = room?.code ?? (panel?.kind === "building" ? panel.code : null);
  useEffect(() => {
    const layer = layers.current?.markers;
    if (!ready || !layer) return;
    layer.clearLayers();
    for (const group of groups) {
      const category = majorityCategory(group.places);
      const approx = group.places.every((p) => p.campusXY.approx);
      const selected = group.places.some((p) => p.id === focusId) || (group.building && group.building === selectedBuilding);
      const count = group.places.length;
      const first = placeText(group.places[0], lang).name;
      const html = `<div class="cpin${approx ? " approx" : ""}${selected ? " sel" : ""}" style="--c:${CATEGORY_PIN_COLORS[category] ?? "#3b4452"}"><span><i>${EMOJI[category] ?? "📍"}</i></span>${count > 1 ? `<span class="cnt">${count}</span>` : ""}</div>`;
      const marker = L.marker(ll(group.x, group.y), {
        icon: L.divIcon({ className: "", html, iconSize: [34, 34], iconAnchor: [17, 40] }),
        riseOnHover: true,
        zIndexOffset: selected ? 900 : count * 5,
        title: count > 1 ? `${group.building ? buildingName(data, group.building) : first} · ${t.pinGroup(count)}` : first,
        alt: count > 1 ? t.pinGroup(count) : first,
      });
      marker.on("click", () => {
        if (group.building) setPanel({ kind: "building", code: group.building });
        else if (count === 1) onOpen(group.places[0].id);
        else setPanel({ kind: "group", key: group.key });
      });
      marker.addTo(layer);
    }
  }, [ready, groups, focusId, selectedBuilding, lang, t, data, onOpen]);

  // 강의실 검색이나 고른 장소로 이동한다.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const zoom = Math.max(map.getZoom(), homeZoom.current + 0.75);
    if (room) {
      const b = data.buildings.find((x) => x.code === room.code);
      if (b) {
        map.setView(ll(b.x, b.y), zoom);
        setPanel({ kind: "building", code: b.code });
      }
      return;
    }
    const target = focusId ? groups.find((g) => g.places.some((p) => p.id === focusId)) : null;
    if (target) map.setView(ll(target.x, target.y), zoom);
    // ll 은 H 에만 의존한다.
  }, [ready, room?.code, focusId]);

  // 학생 추천 동선
  const route = data.routes.find((r) => r.id === routeId) ?? null;
  useEffect(() => {
    const layer = layers.current?.route;
    const map = mapRef.current;
    if (!ready || !layer || !map) return;
    layer.clearLayers();
    if (!route) return;
    const line = route.line.map(([x, y]) => ll(x, y));
    L.polyline(line, { color: "#fff", weight: 10, opacity: 0.9, interactive: false }).addTo(layer);
    L.polyline(line, { color: route.color, weight: 6, interactive: false }).addTo(layer);
    route.stops.forEach((s, i) => {
      L.marker(ll(s.x, s.y), {
        icon: L.divIcon({ className: "", html: `<span class="routeStop" style="--c:${route.color}">${i + 1}</span>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: `${i + 1}. ${s.name}`,
        keyboard: false,
      }).addTo(layer);
    });
    map.fitBounds(L.latLngBounds(line).pad(0.25));
  }, [ready, route]);

  // 필터로 사라진 묶음의 안내 창은 닫는다.
  useEffect(() => {
    if (panel?.kind === "group" && !groups.some((g) => g.key === panel.key)) setPanel(null);
  }, [groups, panel]);

  const panelPlaces =
    panel?.kind === "group"
      ? (groups.find((g) => g.key === panel.key)?.places ?? [])
      : panel?.kind === "building"
        ? (groups.find((g) => g.building === panel.code)?.places ?? [])
        : [];
  const floorInfo = panel?.kind === "building" ? data.floors?.buildings[panel.code] : undefined;

  return (
    <section className="campusView" aria-label={t.campusMap}>
      <div className="mapCanvasWrap">
        <div ref={containerRef} className="campusCanvas" role="application" aria-label={t.campusMapLabel} />
        {panel && (
          <div className="pinPanel" role="region" aria-label={panel.kind === "building" ? buildingName(data, panel.code) : t.pinGroup(panelPlaces.length)} onKeyDown={(e) => e.key === "Escape" && setPanel(null)}>
            <div className="pinPanelHead">
              <h2>{panel.kind === "building" ? `${panel.code} ${buildingName(data, panel.code)}` : t.pinGroup(panelPlaces.length)}</h2>
              <button type="button" className="iconButton" onClick={() => setPanel(null)} aria-label={t.closePanel}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="pinPanelBody">
              {panel.kind === "building" && (
                <section aria-label={t.floors}>
                  <h3 className="panelTitle">{t.floors}</h3>
                  {floorInfo?.floors.length ? (
                    <ul className="floorList">
                      {floorInfo.floors.map(([floor, names]) => (
                        <li key={floor} className={room?.floor && room.code === panel.code && floorHas(floor, room.floor) ? "hit" : undefined}>
                          <b>{t.floorN(floor)}</b>
                          <span lang="ko">{names.join(", ")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">{t.floorEmpty}</p>
                  )}
                  {data.floors && <p className="hint">{t.floorSource(data.floors.checked)}</p>}
                </section>
              )}
              {panelPlaces.length > 0 && (
                <section aria-label={t.buildingPlaces(panelPlaces.length)}>
                  {panel.kind === "building" && <h3 className="panelTitle">{t.buildingPlaces(panelPlaces.length)}</h3>}
                  <ul className="pinList">
                    {panelPlaces.map((place) => {
                      const text = placeText(place, lang);
                      return (
                        <li key={place.id} data-category={place.category}>
                          <button type="button" className="pinItem" onClick={() => onOpen(place.id)}>
                            <span className="badge">{text.category}</span>
                            <span className="pinName">{text.name}</span>
                            {text.summary && <span className="pinSummary">{text.summary}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="mapNote">
        {groups.length === 0 ? t.campusNoPins : places.length > pinned ? t.campusOffMap(places.length - pinned) : ""}
      </p>

      <section className="routeList" aria-labelledby="routesTitle">
        <h2 id="routesTitle" className="blockTitle">
          <Footprints size={18} aria-hidden="true" /> {t.routes}
        </h2>
        {data.routes.map((r) => (
          <button
            key={r.id}
            type="button"
            className="routeItem"
            style={{ "--c": r.color } as CSSProperties}
            aria-pressed={routeId === r.id}
            onClick={() => setRouteId(routeId === r.id ? null : r.id)}
          >
            <span className="swatch" aria-hidden="true" />
            <span>
              <strong lang="ko">{r.title}</strong>
              <span lang="ko">{r.stops.map((s) => s.name).join(" → ")}</span>
              <br />
              <span>{t.routeWalk(r.meters, Math.max(1, Math.round(r.meters / 70)))}</span>
              {routeId === r.id && (
                <>
                  <br />
                  <span lang="ko">{r.desc}</span>
                </>
              )}
            </span>
          </button>
        ))}
      </section>
    </section>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

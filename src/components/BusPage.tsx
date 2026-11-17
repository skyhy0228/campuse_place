import { Bell, BellOff, BusFront, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { boardingStops, departures, kst, minutesUntil, parseNote, serviceDay, upcoming, type BusData, type BusRoute, type Departure } from "../lib/bus";
import { alarmId, type BusAlarmsApi } from "../lib/busAlarms";
import { useTicker } from "../lib/busData";
import { useLang } from "../lib/i18n";

const LEADS = [3, 5, 10];
const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // 저장소를 못 써도 화면은 동작한다.
    }
  },
};

// 마지막으로 본 노선 (홈의 다음 버스 카드도 같은 노선을 보여준다)
export const savedRouteId = () => store.get("busRoute") ?? "999-city";

interface Props {
  data: BusData;
  alarms: BusAlarmsApi;
}

export function BusPage({ data, alarms }: Props) {
  const { t } = useLang();
  const now = useTicker();
  const { ymd, seconds } = kst(now);
  const day = serviceDay(data, now);
  const running = day.status === "service";

  const [routeId, setRouteId] = useState(() => (data.routes.some((r) => r.id === savedRouteId()) ? savedRouteId() : data.routes[0].id));
  const route = data.routes.find((r) => r.id === routeId) ?? data.routes[0];
  const stops = boardingStops(route);
  const [stop, setStop] = useState(stops[0]);
  const [lead, setLead] = useState(() => {
    const saved = Number(store.get("busLead"));
    return LEADS.includes(saved) ? saved : 5;
  });

  useEffect(() => store.set("busRoute", routeId), [routeId]);
  useEffect(() => store.set("busLead", String(lead)), [lead]);
  const boardStop = stops.includes(stop) ? stop : stops[0];

  const next = running ? upcoming(route, boardStop, seconds, 3) : [];
  const nextTrip = next[0]?.trip;
  const routeName = (r: BusRoute) => t.busRoutes[r.id] ?? r.number;
  const activeIds = useMemo(() => new Set(alarms.alarms.map((a) => a.id)), [alarms.alarms]);

  const statusText =
    day.status === "service"
      ? t.busStatusService
      : day.status === "weekend"
        ? t.busStatusWeekend
        : day.status === "holiday"
          ? t.busStatusHoliday
          : t.busStatusNoService(day.label);

  const bell = (dep: Departure, big = false) => {
    if (!running) return null;
    const id = alarmId(route.id, boardStop, dep.time, ymd);
    const on = activeIds.has(id);
    const tooLate = !on && minutesUntil(dep, seconds) < lead;
    const label = tooLate ? `${dep.time} · ${t.busAlarmTooLate}` : on ? t.busAlarmOffLabel(dep.time) : t.busAlarmSetLabel(dep.time, lead);
    // 큰 버튼은 보이는 글자가 이름에 들어가도록 aria-label 대신 숨긴 글자를 앞에 붙인다.
    if (big)
      return (
        <button
          type="button"
          className={`button small${on ? " active" : ""}`}
          aria-pressed={on}
          disabled={tooLate}
          title={tooLate ? t.busAlarmTooLate : undefined}
          onClick={() => (on ? alarms.remove(id) : void alarms.add({ routeId: route.id, stop: boardStop, time: dep.time, date: ymd, lead }))}
        >
          {on ? <BellOff size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
          <span className="srOnly">{dep.time} · </span>
          {on ? t.busAlarmOff : t.busAlarmOn(lead)}
        </button>
      );
    return (
      <button
        type="button"
        className={`iconButton${on ? " active" : ""}`}
        aria-pressed={on}
        disabled={tooLate}
        title={label}
        aria-label={label}
        onClick={() => (on ? alarms.remove(id) : void alarms.add({ routeId: route.id, stop: boardStop, time: dep.time, date: ymd, lead }))}
      >
        {on ? <BellOff size={17} aria-hidden="true" /> : <Bell size={17} aria-hidden="true" />}
      </button>
    );
  };

  const deps = departures(route, boardStop);
  const nextAfterStop = (dep: Departure) =>
    route.trips[dep.trip].times
      .map((time, i) => ({ time, stop: route.stops[i], i }))
      .filter((x) => x.time && x.i > boardStop);

  return (
    <section className="busPage" aria-labelledby="busTitle">
      <h2 id="busTitle" className="busHead">
        <BusFront size={22} aria-hidden="true" />
        {t.busTitle}
      </h2>

      <p className={`busStatus glass${running ? "" : " off"}`} role="status">
        <strong>{statusText}</strong>
        {!day.holidaysKnown && <span> {t.busHolidaysUnknown}</span>}
        <span className="hint"> {t.busOffNote}</span>
      </p>

      <div className="segmented full busRoutes" role="group" aria-label={t.busRouteGroup}>
        {data.routes.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === route.id}
            onClick={() => {
              setRouteId(r.id);
              setStop(boardingStops(r)[0]); // 노선을 바꾸면 그 노선의 첫 정류장부터
            }}
          >
            {routeName(r)}
          </button>
        ))}
      </div>

      <div className="chipRow busStops" role="group" aria-label={t.busBoardAt}>
        <span className="hint">{t.busBoardAt}</span>
        {stops.map((i) => (
          <button key={i} type="button" className="chip" aria-pressed={i === boardStop} onClick={() => setStop(i)}>
            {route.stops[i]}
          </button>
        ))}
      </div>

      {running && (
        <div className="busNext glass" aria-live="polite">
          <p className="busNextLabel">{t.busNext}</p>
          {next.length ? (
            <>
              <p className="busCountdown">
                <strong>{t.busIn(minutesUntil(next[0], seconds))}</strong>
                <span>{t.busDepart(next[0].time, route.stops[boardStop])}</span>
              </p>
              <p className="busPath">
                {nextAfterStop(next[0])
                  .map((x) => `${x.stop} ${x.time}`)
                  .join(" → ")}
                {route.trips[next[0].trip].note && <span className="busNote"> · {noteText(route.trips[next[0].trip].note, t.busNotes)}</span>}
              </p>
              <div className="busNextActions">
                {bell(next[0], true)}
                {next.length > 1 && (
                  <p className="hint">
                    {t.busThen}: {next.slice(1).map((d) => `${d.time} (${t.busIn(minutesUntil(d, seconds))})`).join(", ")}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p>{t.busNoMore}</p>
          )}
        </div>
      )}

      {running && (
        <div className="busAlarmBar">
          <label htmlFor="busLead">{t.busAlarmLead}</label>
          <select id="busLead" value={lead} onChange={(e) => setLead(Number(e.target.value))}>
            {LEADS.map((n) => (
              <option key={n} value={n}>
                {t.busAlarmLeadOption(n)}
              </option>
            ))}
          </select>
          <p className="hint">
            {alarms.permission === "denied" ? t.busAlarmDenied : alarms.permission === "unsupported" ? t.busAlarmUnsupported : t.busAlarmHint}
          </p>
        </div>
      )}

      {alarms.alarms.length > 0 && (
        <div className="busAlarmList">
          <h3>{t.busAlarmList}</h3>
          <ul>
            {alarms.alarms.map((a) => {
              const r = data.routes.find((x) => x.id === a.routeId);
              return (
                <li key={a.id} className="chip">
                  {r ? routeName(r) : a.routeId} · {r?.stops[a.stop]} {a.time} · {t.busAlarmLeadOption(a.lead)}
                  <button type="button" className="chipX" onClick={() => alarms.remove(a.id)} aria-label={t.busAlarmOffLabel(a.time)}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h3 className="busTableTitle">{t.busTimetable}</h3>
      <div className="busTableWrap glass">
        <table className="busTable">
          <caption className="srOnly">{t.busTimetableCaption(routeName(route))}</caption>
          <thead>
            <tr>
              {route.stops.map((s, i) => (
                <th key={i} scope="col" className={i === boardStop ? "board" : undefined}>
                  {s}
                </th>
              ))}
              {running && (
                <th scope="col">
                  <span className="srOnly">{t.busAlarmCol}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {route.trips.map((trip, ti) => {
              const dep = deps.find((d) => d.trip === ti);
              const past = running && (dep ? dep.minutes * 60 + 59 < seconds : false);
              const note = noteText(trip.note, t.busNotes);
              return (
                <tr key={ti} className={ti === nextTrip ? "next" : past ? "past" : undefined}>
                  {trip.times.map((time, i) => (
                    <td key={i} className={i === boardStop ? "board" : undefined}>
                      {time ?? "–"}
                      {i === 0 && note && <span className="busNote">{note}</span>}
                    </td>
                  ))}
                  {running && <td>{dep && !past ? bell(dep) : null}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="busFoot hint">
        {route.number === "999" && <p>{t.busCampusNote}</p>}
        <p>{t.busChecked(data.checkedAt)}</p>
        <p>
          {t.busSources}:{" "}
          {data.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

function noteText(note: string | undefined, notes: Record<string, (t: string) => string>) {
  const parsed = parseNote(note);
  return parsed ? notes[parsed.kind]?.(parsed.time ?? "") ?? "" : "";
}

// 홈 화면의 작은 카드: 마지막으로 본 노선의 다음 버스
export function NextBusCard({ data, onOpen }: { data: BusData; onOpen: () => void }) {
  const { t } = useLang();
  const now = useTicker();
  const route = data.routes.find((r) => r.id === savedRouteId()) ?? data.routes[0];
  const stop = boardingStops(route)[0];
  const day = serviceDay(data, now);
  const { seconds } = kst(now);
  const next = day.status === "service" ? upcoming(route, stop, seconds, 1)[0] : undefined;
  const text =
    day.status !== "service"
      ? day.status === "weekend"
        ? t.busStatusWeekend
        : day.status === "holiday"
          ? t.busStatusHoliday
          : t.busStatusNoService(day.label)
      : next
        ? `${t.busIn(minutesUntil(next, seconds))} · ${t.busDepart(next.time, route.stops[stop])}`
        : t.busNoMore;
  return (
    <button type="button" className="nextBusCard glass" onClick={onOpen}>
      <BusFront size={22} aria-hidden="true" />
      <span className="nextBusText">
        <span className="hint">
          {t.busNext} · {t.busRoutes[route.id] ?? route.number}
        </span>
        <strong>{text}</strong>
      </span>
      <span className="srOnly">{t.busOpenPage}</span>
    </button>
  );
}

// 알림이 울렸을 때 화면 위에 띄우는 안내
export function BusAlarmToasts({ data, alarms }: { data: BusData | null; alarms: BusAlarmsApi }) {
  const { t } = useLang();
  if (!alarms.fired.length) return null;
  return (
    <div className="busToasts" role="alert">
      {alarms.fired.map((a) => {
        const r = data?.routes.find((x) => x.id === a.routeId);
        return (
          <div key={a.id} className="busToast glass">
            <Bell size={18} aria-hidden="true" />
            <p>
              <strong>{t.busAlarmFireTitle(r ? (t.busRoutes[r.id] ?? r.number) : a.routeId, a.time)}</strong>
              <span>{t.busAlarmFireBody(r?.stops[a.stop] ?? "", a.lead)}</span>
            </p>
            <button type="button" className="iconButton" onClick={() => alarms.dismiss(a.id)} aria-label={t.busAlarmDismiss}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

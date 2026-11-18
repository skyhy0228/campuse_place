// 관리자 화면의 학식·버스 입력과 통계. (AdminPage 와 같이 따로 불러온다)
// 학식과 버스 시간표는 학교·버스 회사 공지를 보고 운영자가 직접 입력한다. 사이트가 추측해서 채우지 않는다.
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DAY_TYPES, parseTimes, type DayType } from "../lib/bus";
import { addDays, kstDateString, weekRange } from "../lib/dates";
import type { PlaceView } from "../lib/places";
import {
  MEALS,
  adminDeleteBus,
  adminDeleteMenu,
  adminSaveBus,
  adminSaveMenu,
  adminStats,
  listBusTimes,
  listMenus,
  type AdminStats,
  type BusTime,
  type CafeteriaMenu,
  type Meal,
} from "../lib/remote";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MEAL_LABEL: Record<Meal, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };
const DAY_LABEL: Record<DayType, string> = { weekday: "평일", weekend: "주말", everyday: "매일" };

// ---------- 학식 ----------
const emptyMenu = (day: string) => ({ served_on: day, cafeteria: "", meal: "lunch" as Meal, items: "", price: "", note: "" });

export function MenuAdmin({ onChanged }: { onChanged: () => void }) {
  const today = kstDateString(new Date());
  // 지난주부터 다음 주까지 보여준다.
  const from = addDays(weekRange(today).start, -7);
  const to = addDays(weekRange(today).end, 7);
  const [rows, setRows] = useState<CafeteriaMenu[]>([]);
  const [form, setForm] = useState(emptyMenu(today));
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listMenus(from, to).then(setRows, (e) => setMessage(`불러오지 못했습니다: ${messageOf(e)}`));
  }, [from, to]);
  useEffect(load, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminSaveMenu(
        { served_on: form.served_on, cafeteria: form.cafeteria.trim(), meal: form.meal, items: form.items.trim(), price: form.price.trim() || null, note: form.note.trim() || null },
        editId ?? undefined,
      );
      setMessage(editId ? "고쳤습니다." : "추가했습니다.");
      setEditId(null);
      setForm({ ...emptyMenu(form.served_on), cafeteria: form.cafeteria });
      load();
      onChanged();
    } catch (e) {
      setMessage(`실패: ${messageOf(e)} (같은 날·식당·끼니는 하나만 넣을 수 있습니다)`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: CafeteriaMenu) => {
    if (!window.confirm(`${row.served_on} ${row.cafeteria} ${MEAL_LABEL[row.meal]} 메뉴를 지울까요?`)) return;
    try {
      await adminDeleteMenu(row.id);
      setMessage("지웠습니다.");
      load();
      onChanged();
    } catch (e) {
      setMessage(`실패: ${messageOf(e)}`);
    }
  };

  const cafeterias = [...new Set(rows.map((r) => r.cafeteria))];

  return (
    <div className="adminData">
      <form className="adminItem glass" onSubmit={save} aria-label="학식 메뉴 입력">
        <p className="hint">학교 홈페이지나 식당 공지를 보고 입력하세요. 메뉴는 줄바꿈이나 쉼표로 나눕니다.</p>
        <div className="adminGrid">
          <div className="field">
            <label htmlFor="menu-day">날짜</label>
            <input id="menu-day" type="date" value={form.served_on} onChange={(e) => setForm({ ...form, served_on: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="menu-place">식당 이름</label>
            <input id="menu-place" list="menu-places" value={form.cafeteria} onChange={(e) => setForm({ ...form, cafeteria: e.target.value })} maxLength={30} required />
            <datalist id="menu-places">
              {cafeterias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="menu-meal">끼니</label>
            <select id="menu-meal" value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value as Meal })}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="menu-price">가격 (선택)</label>
            <input id="menu-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} maxLength={40} placeholder="예: 5,000원" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="menu-items">메뉴</label>
          <textarea id="menu-items" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} maxLength={500} rows={4} required />
        </div>
        <div className="field">
          <label htmlFor="menu-note">메모 (선택)</label>
          <input id="menu-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} placeholder="예: 11:30~13:30, 학생증 할인" />
        </div>
        <div className="buttonRow">
          <button type="submit" className="button primary" disabled={busy}>
            {editId ? "고치기" : "추가"}
          </button>
          {editId && (
            <button type="button" className="button" onClick={() => { setEditId(null); setForm(emptyMenu(today)); }}>
              취소
            </button>
          )}
        </div>
        {message && (
          <p className="formNotice" role="status">
            {message}
          </p>
        )}
      </form>

      <h3 className="panelTitle">
        {from} ~ {to} 입력한 메뉴 {rows.length}개
      </h3>
      <ul className="collectionList">
        {rows.length === 0 && <li className="hint">입력한 메뉴가 없습니다.</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <span>
              {row.served_on} · {row.cafeteria} · {MEAL_LABEL[row.meal]}
              <span className="hint"> {row.items.replace(/\n/g, ", ").slice(0, 60)}</span>
            </span>
            <span className="actions">
              <button
                type="button"
                className="iconButton"
                aria-label={`${row.served_on} ${row.cafeteria} ${MEAL_LABEL[row.meal]} 고치기`}
                onClick={() => {
                  setEditId(row.id);
                  setForm({ served_on: row.served_on, cafeteria: row.cafeteria, meal: row.meal, items: row.items, price: row.price ?? "", note: row.note ?? "" });
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button type="button" className="iconButton" aria-label={`${row.served_on} ${row.cafeteria} ${MEAL_LABEL[row.meal]} 지우기`} onClick={() => remove(row)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 버스 ----------
const emptyBus = () => ({ line: "", stop: "", direction: "", day_type: "weekday" as DayType, times: "", note: "", source: "", sort_order: 0 });

export function BusAdmin({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<BusTime[]>([]);
  const [form, setForm] = useState(emptyBus());
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = parseTimes(form.times);

  const load = useCallback(() => {
    listBusTimes().then(setRows, (e) => setMessage(`불러오지 못했습니다: ${messageOf(e)}`));
  }, []);
  useEffect(load, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.length) {
      setMessage("출발 시각을 HH:MM 형식으로 하나 이상 적어 주세요.");
      return;
    }
    setBusy(true);
    try {
      await adminSaveBus(
        {
          line: form.line.trim(),
          stop: form.stop.trim(),
          direction: form.direction.trim() || null,
          day_type: form.day_type,
          times: parsed,
          note: form.note.trim() || null,
          source: form.source.trim() || null,
          sort_order: Number(form.sort_order) || 0,
        },
        editId ?? undefined,
      );
      setMessage(editId ? "고쳤습니다." : "추가했습니다.");
      setEditId(null);
      setForm(emptyBus());
      load();
      onChanged();
    } catch (e) {
      setMessage(`실패: ${messageOf(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: BusTime) => {
    if (!window.confirm(`${row.line} ${row.stop} 시간표를 지울까요?`)) return;
    try {
      await adminDeleteBus(row.id);
      setMessage("지웠습니다.");
      load();
      onChanged();
    } catch (e) {
      setMessage(`실패: ${messageOf(e)}`);
    }
  };

  return (
    <div className="adminData">
      <form className="adminItem glass" onSubmit={save} aria-label="버스 시간표 입력">
        <p className="hint">버스 회사·학교 공지의 시간표를 그대로 옮겨 적으세요. 출처와 확인한 날을 함께 남기면 좋습니다.</p>
        <div className="adminGrid">
          <div className="field">
            <label htmlFor="bus-line">노선 이름</label>
            <input id="bus-line" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} maxLength={40} placeholder="예: 통학버스 (서울)" required />
          </div>
          <div className="field">
            <label htmlFor="bus-stop">타는 곳</label>
            <input id="bus-stop" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })} maxLength={40} required />
          </div>
          <div className="field">
            <label htmlFor="bus-dir">방향 (선택)</label>
            <input id="bus-dir" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="bus-day">운행 요일</label>
            <select id="bus-day" value={form.day_type} onChange={(e) => setForm({ ...form, day_type: e.target.value as DayType })}>
              {DAY_TYPES.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bus-order">보여줄 순서 (작을수록 위)</label>
            <input id="bus-order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="bus-times">출발 시각</label>
          <textarea id="bus-times" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} rows={3} placeholder="07:30, 08:10, 12:00 …" aria-describedby="bus-times-hint" required />
          <p className="hint" id="bus-times-hint">
            읽은 시각 {parsed.length}개{parsed.length ? `: ${parsed.slice(0, 8).join(", ")}${parsed.length > 8 ? " …" : ""}` : ""}
          </p>
        </div>
        <div className="adminGrid">
          <div className="field">
            <label htmlFor="bus-source">출처 (선택)</label>
            <input id="bus-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} maxLength={200} placeholder="예: 학교 홈페이지 공지 (11/17 확인)" />
          </div>
          <div className="field">
            <label htmlFor="bus-note">메모 (선택)</label>
            <input id="bus-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} />
          </div>
        </div>
        <div className="buttonRow">
          <button type="submit" className="button primary" disabled={busy}>
            {editId ? "고치기" : "추가"}
          </button>
          {editId && (
            <button type="button" className="button" onClick={() => { setEditId(null); setForm(emptyBus()); }}>
              취소
            </button>
          )}
        </div>
        {message && (
          <p className="formNotice" role="status">
            {message}
          </p>
        )}
      </form>

      <h3 className="panelTitle">입력한 시간표 {rows.length}개</h3>
      <ul className="collectionList">
        {rows.length === 0 && <li className="hint">입력한 시간표가 없습니다.</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <span>
              {row.line} · {row.stop}
              {row.direction ? ` → ${row.direction}` : ""} · {DAY_LABEL[row.day_type]}
              <span className="hint"> {row.times.length}회</span>
            </span>
            <span className="actions">
              <button
                type="button"
                className="iconButton"
                aria-label={`${row.line} ${row.stop} 고치기`}
                onClick={() => {
                  setEditId(row.id);
                  setForm({ line: row.line, stop: row.stop, direction: row.direction ?? "", day_type: row.day_type, times: row.times.join(", "), note: row.note ?? "", source: row.source ?? "", sort_order: row.sort_order });
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button type="button" className="iconButton" aria-label={`${row.line} ${row.stop} 지우기`} onClick={() => remove(row)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 통계 ----------
export function StatsPanel({ places }: { places: PlaceView[] }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const names = new Map(places.map((p) => [p.id, p.name]));

  useEffect(() => {
    adminStats().then(setStats, (e) => setError(`불러오지 못했습니다: ${messageOf(e)}`));
  }, []);

  if (error) return <p className="formError">{error}</p>;
  if (!stats) return <p className="hint">불러오는 중…</p>;

  const tiles: [string, number | string][] = [
    ["회원", stats.members],
    ["최근 7일 가입", stats.members7],
    ["후기", `${stats.reviews} (숨김 ${stats.reviewsHidden})`],
    ["대기 중인 제보", stats.submissions.pending ?? 0],
    ["승인한 제보", stats.submissions.approved ?? 0],
    ["최근 30일 '아직 맞아요'", stats.confirms30],
    ["최근 30일 상세 조회", stats.views30],
  ];

  const top = (title: string, rows: { id: string; n: number }[], unit: string) => (
    <section className="adminItem glass" aria-label={title}>
      <h3 className="panelTitle">{title}</h3>
      {rows.length === 0 ? (
        <p className="hint">아직 기록이 없습니다.</p>
      ) : (
        <ol className="rankList">
          {rows.map((r) => (
            <li key={r.id}>
              <span>{names.get(r.id) ?? r.id}</span>
              <span className="count">
                {r.n}
                {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  return (
    <div className="adminData">
      <ul className="statTiles">
        {tiles.map(([label, value]) => (
          <li key={label} className="glass">
            <span className="hint">{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
      <div className="adminGrid">
        {top("많이 본 장소 (최근 30일)", stats.topViews, "회")}
        {top("즐겨찾기 많은 곳", stats.topFavorites, "명")}
      </div>
      <p className="hint">조회수는 장소 상세를 연 횟수이며(같은 화면에서 한 번), 로그인 없이 셀 수 있어 참고용입니다.</p>
    </div>
  );
}

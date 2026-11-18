// 관리자 화면 (?view=admin). admins 표에 등록된 회원만 내용을 볼 수 있고, 실제 권한은 서버(RLS)가 검사한다.
// 교통여지도 admin.html 의 흐름(대기 → 승인 / 수정 후 승인 / 거절하면 사진 삭제)을 옮겼다.
import { Check, EyeOff, Eye, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  adminDeleteReview,
  adminDeleteSubmission,
  adminListProfiles,
  adminListReviews,
  adminListSubmissions,
  adminRejectSubmission,
  adminSetReviewHidden,
  adminSetSuspended,
  adminUpdateSubmission,
  photoUrl,
  type AdminProfile,
  type AdminReview,
  type Submission,
  type SubmissionStatus,
} from "../lib/remote";
import { useSession } from "../lib/session";
import { CHANGE_FIELDS, MAX_CHANGE_LENGTH, cleanChanges, type ChangeField } from "../lib/overrides";
import type { PlaceView } from "../lib/places";
import { BusAdmin, MenuAdmin, StatsPanel } from "./AdminData";

type Tab = SubmissionStatus | "reviews" | "members" | "menus" | "buses" | "stats";
const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "대기" },
  { id: "approved", label: "승인됨" },
  { id: "rejected", label: "거절됨" },
  { id: "reviews", label: "후기" },
  { id: "members", label: "회원" },
  { id: "menus", label: "학식" },
  { id: "buses", label: "버스" },
  { id: "stats", label: "통계" },
];
const CATEGORIES = ["식당", "카페", "학교시설", "숨은장소", "생활꿀팁", "관광지", "자유"];
const CHANGE_LABEL: Record<ChangeField, string> = { hours: "운영시간", closedDays: "휴무일", price: "가격", menu: "대표메뉴", location: "위치" };
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

type ChangeForm = Record<ChangeField, string> & { closed: boolean };
const toForm = (item: Submission): ChangeForm => ({
  hours: item.changes?.hours ?? "",
  closedDays: item.changes?.closedDays ?? "",
  price: item.changes?.price ?? "",
  menu: item.changes?.menu ?? "",
  location: item.changes?.location ?? "",
  closed: Boolean(item.changes?.closed),
});

function SubmissionCard({ item, place, onDone }: { item: Submission; place?: PlaceView; onDone: (msg: string) => void }) {
  const [edit, setEdit] = useState({ name: item.name, category: item.category, location: item.location ?? "", body: item.body });
  const [fixForm, setFixForm] = useState<ChangeForm>(() => toForm(item));
  const [note, setNote] = useState(item.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const fix = item.kind === "fix";
  const changes = fix ? cleanChanges(fixForm) : null;
  const changesEdited = fix && JSON.stringify(changes) !== JSON.stringify(cleanChanges(item.changes ?? null));
  const changed = edit.name !== item.name || edit.category !== item.category || edit.location !== (item.location ?? "") || edit.body !== item.body || changesEdited;
  const placeName = item.place_id ? (place?.name ?? item.place_id) : "";
  // 장소의 지금 값 (원본 또는 이미 반영된 다른 제보)
  const current: Record<ChangeField, string> = {
    hours: place?.hours ?? "",
    closedDays: place?.closedDays ?? "",
    price: place?.price ?? "",
    menu: place?.menu ?? "",
    location: place?.location ?? "",
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      onDone(msg);
    } catch (e) {
      onDone(`실패: ${messageOf(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const patch: Partial<Submission> = {
    name: edit.name.trim(),
    category: edit.category,
    location: edit.location.trim() || null,
    body: edit.body.trim(),
    admin_note: note.trim() || null,
    ...(fix ? { changes } : {}),
  };

  return (
    <li className="adminItem glass">
      <header>
        <span className="badge">{item.kind === "new" ? "새 장소" : "정보 수정"}</span>
        <strong>{item.name}</strong>
        <span className="meta">
          {item.nickname ?? "(탈퇴한 회원)"} · {item.created_at.slice(0, 16).replace("T", " ")}
          {item.kind === "fix" && placeName ? ` · 대상: ${placeName}` : ""}
        </span>
      </header>
      {item.photos.length > 0 && (
        <div className="adminPhotos">
          {item.photos.map((p) => (
            <a key={p} href={photoUrl(p)} target="_blank" rel="noopener noreferrer">
              <img src={photoUrl(p)} alt="제보 사진" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <div className="adminGrid">
        {item.kind === "new" && (
          <>
            <div className="field">
              <label htmlFor={`n-${item.id}`}>이름</label>
              <input id={`n-${item.id}`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor={`c-${item.id}`}>분류</label>
              <select id={`c-${item.id}`} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`l-${item.id}`}>위치</label>
              <input id={`l-${item.id}`} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} maxLength={120} />
            </div>
          </>
        )}
      </div>
      <div className="field">
        <label htmlFor={`b-${item.id}`}>내용</label>
        <textarea id={`b-${item.id}`} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} maxLength={500} rows={4} />
      </div>
      {fix && (
        <fieldset className="changeFields">
          <legend>사이트에 반영할 값 (승인하면 바로 바뀝니다. 비운 칸은 그대로 둡니다)</legend>
          <div className="adminGrid">
            {CHANGE_FIELDS.map((key) => (
              <div key={key} className="field">
                <label htmlFor={`x-${key}-${item.id}`}>{CHANGE_LABEL[key]}</label>
                <input id={`x-${key}-${item.id}`} value={fixForm[key]} onChange={(e) => setFixForm({ ...fixForm, [key]: e.target.value })} maxLength={MAX_CHANGE_LENGTH} />
                {current[key] && <p className="hint">지금: {current[key]}</p>}
              </div>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={fixForm.closed} onChange={(e) => setFixForm({ ...fixForm, closed: e.target.checked })} />
            폐업·없어짐으로 표시 (목록과 지도에서 빠집니다)
          </label>
          {!changes && <p className="hint">반영할 값이 없으면 승인해도 화면은 바뀌지 않습니다. (원본 XLSX 를 직접 고쳐 반영)</p>}
          {changes?.location && <p className="hint">위치를 바꿔도 지도 좌표는 그대로입니다. 가게가 옮겨 갔다면 data/place-coordinates.json 도 고치세요.</p>}
        </fieldset>
      )}
      {(item.map_url || item.lat) && (
        <p className="meta">
          {item.map_url && (
            <a href={item.map_url} target="_blank" rel="noopener noreferrer">
              네이버 지도 링크
            </a>
          )}
          {item.lat && item.lng && <span>좌표 {item.lat.toFixed(5)}, {item.lng.toFixed(5)}</span>}
        </p>
      )}
      <div className="field">
        <label htmlFor={`m-${item.id}`}>운영 메모 (제보한 회원에게는 보이지 않음)</label>
        <input id={`m-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>
      <div className="buttonRow">
        {item.status === "pending" && (
          <>
            <button type="button" className="button primary" disabled={busy} onClick={() => act(() => adminUpdateSubmission(item.id, { ...patch, status: "approved" }), changed ? "고친 내용으로 승인했습니다." : "승인했습니다.")}>
              <Check size={16} aria-hidden="true" />
              {changed ? "수정 후 승인" : "승인"}
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={() => act(() => adminRejectSubmission(item, note), "거절하고 사진을 지웠습니다.")}>
              <X size={16} aria-hidden="true" />
              거절
            </button>
          </>
        )}
        {item.status === "approved" && (
          <>
            <button type="button" className="button" disabled={busy || !changed} onClick={() => act(() => adminUpdateSubmission(item.id, patch), "저장했습니다.")}>
              수정 저장
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={() => act(() => adminRejectSubmission(item, note), "내렸습니다.")}>
              내리기
            </button>
          </>
        )}
        {item.status === "rejected" && (
          <>
            <button type="button" className="button" disabled={busy} onClick={() => act(() => adminUpdateSubmission(item.id, { status: "pending" }), "대기로 되돌렸습니다.")}>
              <RotateCcw size={16} aria-hidden="true" />
              대기로
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={() => window.confirm("기록을 완전히 지울까요?") && act(() => adminDeleteSubmission(item), "기록을 지웠습니다.")}>
              <Trash2 size={16} aria-hidden="true" />
              기록 지우기
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// onDataChanged: 학식·버스를 고치면 첫 화면의 바로 가기도 새로 불러온다.
// onPlacesChanged: 정보 수정 제보를 승인·내리면 장소 목록에 다시 반영한다.
export default function AdminPage({ places, onDataChanged, onPlacesChanged }: { places: PlaceView[]; onDataChanged: () => void; onPlacesChanged: () => void }) {
  const s = useSession();
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const names = new Map(places.map((p) => [p.id, p.name]));
  const byId = new Map(places.map((p) => [p.id, p]));
  const isSubmissionTab = tab === "pending" || tab === "approved" || tab === "rejected";

  const load = useCallback(async () => {
    if (tab === "menus" || tab === "buses" || tab === "stats") return;
    setLoading(true);
    try {
      if (tab === "reviews") setReviews(await adminListReviews());
      else if (tab === "members") setMembers(await adminListProfiles());
      else setItems(await adminListSubmissions(tab));
    } catch (e) {
      setMessage(`불러오지 못했습니다: ${messageOf(e)}`);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (s.isAdmin) void load();
  }, [s.isAdmin, load]);

  if (!s.user) {
    return (
      <section className="admin notice">
        <h2>관리자 화면</h2>
        <p>운영자 계정으로 로그인하세요.</p>
        <button type="button" className="button primary" onClick={() => s.openAuth("login")}>
          로그인
        </button>
      </section>
    );
  }
  if (!s.isAdmin) {
    return (
      <section className="admin notice">
        <h2>관리자 화면</h2>
        <p>이 계정은 운영자로 등록되어 있지 않습니다. (supabase/schema.sql 아래쪽의 운영자 등록 SQL 을 실행하세요)</p>
      </section>
    );
  }

  const done = (msg: string) => {
    setMessage(msg);
    void load();
    if (isSubmissionTab) onPlacesChanged();
  };

  return (
    <section className="admin" aria-labelledby="adminTitle">
      <h2 id="adminTitle" className="listTitle">
        관리자 화면
      </h2>
      <div className="segmented" role="group" aria-label="관리 메뉴">
        {TABS.map((x) => (
          <button key={x.id} type="button" aria-pressed={tab === x.id} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {message && (
        <p className="formNotice" role="status">
          {message}
        </p>
      )}
      {loading && <p className="hint">불러오는 중…</p>}

      {isSubmissionTab && (
        <ul className="adminList">
          {!loading && items.length === 0 && <li className="hint">항목이 없습니다.</li>}
          {items.map((item) => (
            <SubmissionCard key={`${item.id}-${item.status}`} item={item} place={item.place_id ? byId.get(item.place_id) : undefined} onDone={done} />
          ))}
        </ul>
      )}

      {tab === "menus" && <MenuAdmin onChanged={onDataChanged} />}
      {tab === "buses" && <BusAdmin onChanged={onDataChanged} />}
      {tab === "stats" && <StatsPanel places={places} />}

      {tab === "reviews" && (
        <ul className="adminList">
          {!loading && reviews.length === 0 && <li className="hint">후기가 없습니다.</li>}
          {reviews.map((r) => (
            <li key={r.id} className="adminItem glass">
              <header>
                <strong>{names.get(r.place_id) ?? r.place_id}</strong>
                <span className="meta">
                  ★ {r.rating} · {r.nickname} · 신고 {r.report_count} {r.hidden ? "· 숨김" : ""}
                </span>
              </header>
              {r.body && <p>{r.body}</p>}
              <div className="buttonRow">
                <button type="button" className="button small" onClick={() => adminSetReviewHidden(r.id, !r.hidden).then(() => done(r.hidden ? "다시 보이게 했습니다." : "숨겼습니다."), (e) => setMessage(messageOf(e)))}>
                  {r.hidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                  {r.hidden ? "복구" : "숨기기"}
                </button>
                <button type="button" className="button small danger" onClick={() => window.confirm("이 후기를 지울까요?") && adminDeleteReview(r.id).then(() => done("지웠습니다."), (e) => setMessage(messageOf(e)))}>
                  <Trash2 size={15} aria-hidden="true" />
                  지우기
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "members" && (
        <ul className="collectionList">
          {members.map((m) => (
            <li key={m.id}>
              <span>{m.nickname}</span>
              <span className="count">{m.created_at.slice(0, 10)}</span>
              <button type="button" className={`button small${m.suspended ? "" : " danger"}`} onClick={() => adminSetSuspended(m.id, !m.suspended).then(() => done(m.suspended ? "정지를 풀었습니다." : "글쓰기를 정지했습니다."), (e) => setMessage(messageOf(e)))}>
                {m.suspended ? "정지 풀기" : "글쓰기 정지"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

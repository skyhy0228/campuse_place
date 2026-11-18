// Supabase 테이블·함수 호출 모음. 권한 검사는 서버(RLS·함수)가 하고, 여기서는 형식만 맞춘다.
import type { PlaceChanges } from "../types";
import type { DayType } from "./bus";
import { kstDateString } from "./dates";
import type { Override } from "./overrides";
import { blendRating, type ConfirmStats, type RatingStats } from "./places";
import { PHOTO_BUCKET, friendlyError, photoUrl, supabase } from "./supabase";
import { sanitizeData, type UserData } from "./userData";

function db() {
  if (!supabase) throw new Error("Supabase 가 설정되지 않았습니다.");
  return supabase;
}

async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(friendlyError(error));
  return data;
}

// ---------- 프로필 ----------
export interface Profile {
  nickname: string;
  suspended: boolean;
  isAdmin: boolean;
}

export async function getProfile(): Promise<Profile | null> {
  const rows = await run(db().rpc("my_profile"));
  const row = (rows as { nickname: string; suspended: boolean; is_admin: boolean }[] | null)?.[0];
  return row ? { nickname: row.nickname, suspended: row.suspended, isAdmin: row.is_admin } : null;
}

export async function checkNickname(nickname: string): Promise<string | null> {
  return (await run(db().rpc("nickname_check", { p_nickname: nickname }))) as string | null;
}

export const setNickname = (nickname: string) => run(db().rpc("profile_set_nickname", { p_nickname: nickname }));
export const deleteAccount = () => run(db().rpc("delete_account"));

// ---------- 즐겨찾기·내 목록 ----------
export async function getUserData(): Promise<UserData | null> {
  const row = await run(db().from("user_data").select("data").maybeSingle());
  return row ? sanitizeData((row as { data: unknown }).data) : null;
}

export async function saveUserData(userId: string, data: UserData) {
  await run(db().from("user_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }));
}

// ---------- 별점·후기 ----------
export interface Review {
  id: string;
  nickname: string;
  rating: number;
  body: string | null;
  created_at: string;
  user_id?: string;
}

export async function getRatingStats(): Promise<RatingStats> {
  const rows = (await run(db().from("review_stats").select("place_id, n, total"))) as { place_id: string; n: number; total: number }[];
  return new Map(rows.map((r) => [r.place_id, { count: r.n, total: r.total }]));
}

export async function listReviews(placeId: string, signedIn: boolean): Promise<Review[]> {
  // 로그인하지 않은 사람에게는 작성자 id 를 주지 않는다. (컬럼 권한)
  const columns = signedIn ? "id, nickname, rating, body, created_at, user_id" : "id, nickname, rating, body, created_at";
  return (await run(
    db().from("reviews").select(columns).eq("place_id", placeId).eq("hidden", false).order("created_at", { ascending: false }).limit(200),
  )) as unknown as Review[];
}

export const saveReview = (placeId: string, rating: number, body: string) =>
  run(db().rpc("review_save", { p_place: placeId, p_rating: rating, p_body: body || null }));
export const deleteReview = (placeId: string) => run(db().rpc("review_delete", { p_place: placeId }));
export const reportReview = (id: string) => run(db().rpc("review_report", { p_review: id }));

export const reviewScore = (base: number | undefined, reviews: Review[]) =>
  blendRating(
    base,
    reviews.length,
    reviews.reduce((sum, r) => sum + r.rating, 0),
  );

// ---------- 제보 ----------
export type SubmissionKind = "new" | "fix";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  user_id?: string | null;
  nickname: string | null;
  kind: SubmissionKind;
  place_id: string | null;
  name: string;
  category: string;
  location: string | null;
  body: string;
  map_url: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  status: SubmissionStatus;
  admin_note?: string | null;
  // '정보가 달라요' 제보의 바뀐 값. 운영자가 승인하면 사이트에 바로 반영된다.
  changes?: PlaceChanges | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SubmissionInput {
  kind: SubmissionKind;
  place_id?: string;
  name: string;
  category: string;
  location?: string;
  body: string;
  map_url?: string;
  lat?: number;
  lng?: number;
  photos: string[];
  changes?: PlaceChanges;
}

export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/jpeg" ? "jpg" : "webp";
  const path = `u/${userId}/${crypto.randomUUID()}.${ext}`;
  await run(db().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false }));
  return path;
}

export const createSubmission = (input: SubmissionInput) => run(db().rpc("submission_create", { p: input }));

export async function listApprovedPlaces(): Promise<Submission[]> {
  return (await run(
    db()
      .from("submissions")
      .select("id, nickname, kind, place_id, name, category, location, body, map_url, lat, lng, photos, status, created_at, reviewed_at")
      .eq("status", "approved")
      .eq("kind", "new")
      .order("reviewed_at", { ascending: false })
      .limit(500),
  )) as Submission[];
}

export async function listMySubmissions(userId: string): Promise<Submission[]> {
  return (await run(
    db().from("submissions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  )) as Submission[];
}

export { photoUrl };

// 운영자가 승인한 '정보가 달라요' 제보의 바뀐 값 (누구나 읽기, 서버 함수가 장소 ID·값·승인 시각만 돌려준다)
export async function getPlaceOverrides(): Promise<Override[]> {
  return ((await run(db().rpc("place_overrides"))) as Override[] | null) ?? [];
}

// ---------- '아직 맞아요' 확인 ----------
export const confirmPlace = (placeId: string) => run(db().rpc("place_confirm", { p_place: placeId }));

export async function getConfirmStats(): Promise<ConfirmStats> {
  const rows = ((await run(db().rpc("confirm_stats"))) as { place_id: string; n: number; last_at: string }[] | null) ?? [];
  return new Map(rows.map((r) => [r.place_id, { count: r.n, last: kstDateString(new Date(r.last_at)) }]));
}

// ---------- 조회수 (관리자 통계용, 장소 상세를 열 때 한 번) ----------
export const trackView = (placeId: string) => run(db().rpc("place_view", { p_place: placeId }));

// ---------- 학식 ----------
export type Meal = "breakfast" | "lunch" | "dinner";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner"];

export interface CafeteriaMenu {
  id: string;
  served_on: string;
  cafeteria: string;
  meal: Meal;
  items: string;
  price: string | null;
  note: string | null;
  updated_at?: string;
}
export type CafeteriaInput = Omit<CafeteriaMenu, "id" | "updated_at">;

export async function listMenus(from: string, to: string): Promise<CafeteriaMenu[]> {
  return (await run(
    db().from("cafeteria_menus").select("id, served_on, cafeteria, meal, items, price, note, updated_at").gte("served_on", from).lte("served_on", to).order("served_on").order("cafeteria").limit(500),
  )) as CafeteriaMenu[];
}

// ---------- 버스 시간표 ----------
export interface BusTime {
  id: string;
  line: string;
  stop: string;
  direction: string | null;
  day_type: DayType;
  times: string[];
  note: string | null;
  source: string | null;
  sort_order: number;
  updated_at?: string;
}
export type BusInput = Omit<BusTime, "id" | "updated_at">;

export async function listBusTimes(): Promise<BusTime[]> {
  return (await run(
    db().from("bus_times").select("id, line, stop, direction, day_type, times, note, source, sort_order, updated_at").order("sort_order").order("line").limit(300),
  )) as BusTime[];
}

// ---------- 운영자 ----------
export async function adminSaveMenu(input: CafeteriaInput, id?: string) {
  if (id) await run(db().from("cafeteria_menus").update(input).eq("id", id));
  else await run(db().from("cafeteria_menus").insert(input));
}
export const adminDeleteMenu = (id: string) => run(db().from("cafeteria_menus").delete().eq("id", id));

export async function adminSaveBus(input: BusInput, id?: string) {
  if (id) await run(db().from("bus_times").update(input).eq("id", id));
  else await run(db().from("bus_times").insert(input));
}
export const adminDeleteBus = (id: string) => run(db().from("bus_times").delete().eq("id", id));

export interface AdminStats {
  members: number;
  members7: number;
  reviews: number;
  reviewsHidden: number;
  submissions: Partial<Record<SubmissionStatus, number>>;
  confirms30: number;
  views30: number;
  topViews: { id: string; n: number }[];
  topFavorites: { id: string; n: number }[];
}

export async function adminStats(): Promise<AdminStats> {
  return (await run(db().rpc("admin_stats"))) as AdminStats;
}
export async function adminListSubmissions(status: SubmissionStatus): Promise<Submission[]> {
  return (await run(db().from("submissions").select("*").eq("status", status).order("created_at", { ascending: false }).limit(300))) as Submission[];
}

export async function adminUpdateSubmission(id: string, patch: Partial<Submission>) {
  await run(db().from("submissions").update(patch).eq("id", id));
}

// 거절하면 올라온 사진 파일도 지운다.
export async function adminRejectSubmission(item: Submission, note: string) {
  if (item.photos.length) await run(db().storage.from(PHOTO_BUCKET).remove(item.photos));
  await adminUpdateSubmission(item.id, { status: "rejected", photos: [], admin_note: note || null });
}

export async function adminDeleteSubmission(item: Submission) {
  if (item.photos.length) await run(db().storage.from(PHOTO_BUCKET).remove(item.photos));
  await run(db().from("submissions").delete().eq("id", item.id));
}

export interface AdminReview extends Review {
  place_id: string;
  hidden: boolean;
  report_count: number;
  user_id: string;
}

export async function adminListReviews(): Promise<AdminReview[]> {
  return (await run(
    db()
      .from("reviews")
      .select("id, nickname, place_id, rating, body, hidden, report_count, created_at, user_id")
      .order("report_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
  )) as AdminReview[];
}

export const adminSetReviewHidden = (id: string, hidden: boolean) => run(db().from("reviews").update({ hidden }).eq("id", id));
export const adminDeleteReview = (id: string) => run(db().from("reviews").delete().eq("id", id));

export interface AdminProfile {
  id: string;
  nickname: string;
  suspended: boolean;
  created_at: string;
}

export async function adminListProfiles(): Promise<AdminProfile[]> {
  return (await run(db().from("profiles").select("id, nickname, suspended, created_at").order("created_at", { ascending: false }).limit(500))) as AdminProfile[];
}

export const adminSetSuspended = (id: string, suspended: boolean) => run(db().from("profiles").update({ suspended }).eq("id", id));

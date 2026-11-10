// Supabase 연결. Project URL 과 publishable 키(공개용)가 있을 때만 만든다. 없으면 회원·후기·제보를 Supabase 없이 동작시킨다.
// - 키는 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (로컬은 .env.local, 배포는 GitHub Actions Variables)
// - secret / service_role 키는 절대 넣지 않는다. 보호는 supabase/schema.sql 의 RLS 가 한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

export const supabaseEnabled = Boolean(URL && KEY);

// 이메일 인증·비밀번호 재설정 링크를 다른 기기에서 열어도 되도록 implicit 흐름을 쓴다. (주소의 #access_token 을 읽고 지운다)
export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(URL!, KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "campuse:sb-auth" },
    })
  : null;

export const PHOTO_BUCKET = "place-photos";
export const photoUrl = (path: string) => `${URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;

// Supabase·PostgREST 오류를 사용자에게 보여줄 문장으로 바꾼다. 서버 함수가 낸 한국어 문구(P0001)는 그대로 쓴다.
export function friendlyError(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number } | null;
  const message = e?.message ?? "";
  if (e?.code === "P0001" && message) return message;
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (/email not confirmed/i.test(message)) return "메일함에서 이메일 인증을 마친 뒤 로그인해 주세요.";
  if (/already registered|already been registered/i.test(message)) return "이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정하세요.";
  if (/password should be|weak password/i.test(message)) return "비밀번호가 너무 약합니다. 8자 이상, 영문과 숫자를 섞어 주세요.";
  if (/rate limit|too many|security purposes/i.test(message)) return "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요.";
  if (/same password|different from the old/i.test(message)) return "이전과 다른 비밀번호를 입력하세요.";
  if (/failed to fetch|network/i.test(message)) return "서버에 연결하지 못했습니다. 네트워크를 확인하세요.";
  if (/jwt|session/i.test(message)) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  return message || "알 수 없는 오류가 발생했습니다.";
}

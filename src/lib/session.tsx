import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AuthError,
  currentUser,
  deleteAccount as deleteLocalAccount,
  loginUser,
  logoutUser,
  registerUser,
  startSession,
  type PublicUser,
  type RegisterInput,
} from "./auth";
import * as remote from "./remote";
import { friendlyError, supabase } from "./supabase";
import {
  GUEST_STORAGE_KEY,
  MAX_COLLECTIONS,
  MAX_COLLECTION_NAME,
  mergeData,
  newCollectionId,
  readAccountData,
  readGuestFavorites,
  sanitizeData,
  writeAccountData,
  writeGuestFavorites,
  type Collection,
  type UserData,
} from "./userData";

export type AuthMode = "login" | "signup" | "reset";

// local: 이 브라우저의 localStorage 계정 (Supabase 키가 없을 때)
// cloud: Supabase 이메일 계정. 즐겨찾기·내 목록이 서버에 저장되어 기기 사이에 동기화된다.
export type Backend = "local" | "cloud";

interface SessionValue {
  backend: Backend;
  user: PublicUser | null;
  email: string;
  isAdmin: boolean;
  suspended: boolean;
  // 비밀번호 재설정 메일의 링크로 들어와 새 비밀번호를 정해야 하는 상태
  recovery: boolean;
  syncError: string;
  favoriteIds: Set<string>;
  collections: Collection[];
  guestFavoriteCount: number;

  authMode: AuthMode | null;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  accountOpen: boolean;
  openAccount: () => void;
  closeAccount: () => void;

  login: (username: string, password: string, remember: boolean) => Promise<void>;
  register: (input: RegisterInput, options: { importGuestFavorites: boolean; remember: boolean }) => Promise<void>;
  cloudSignUp: (input: { email: string; password: string; nickname: string; importGuestFavorites: boolean }) => Promise<"confirm" | "done">;
  cloudRequestReset: (email: string) => Promise<void>;
  cloudUpdatePassword: (password: string) => Promise<void>;
  changeNickname: (nickname: string) => Promise<void>;
  logout: () => void;
  removeAccount: (password: string) => Promise<void>;

  toggleFavorite: (placeId: string) => void;
  createCollection: (name: string, placeId?: string) => string | null;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  toggleInCollection: (collectionId: string, placeId: string) => void;
  exportData: () => UserData;
  importData: (raw: unknown) => { favorites: number; collections: number };
  importGuestFavorites: () => number;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider 안에서만 사용할 수 있습니다.");
  return value;
}

const toggleIn = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

// 가입하고 이메일 인증을 마친 뒤 처음 로그인할 때 비회원 즐겨찾기를 가져온다.
const IMPORT_FLAG = "campuse:importGuestOnLogin";
const SAVE_DELAY = 600;
const siteUrl = () => `${location.origin}${location.pathname}`;

export function SessionProvider({ children }: { children: ReactNode }) {
  const cloud = supabase;
  const backend: Backend = cloud ? "cloud" : "local";
  const [user, setUser] = useState<PublicUser | null>(() => (cloud ? null : currentUser()));
  const [data, setData] = useState<UserData>(() => (user ? readAccountData(user.id) : sanitizeData(null)));
  const [guestFavorites, setGuestFavorites] = useState<string[]>(readGuestFavorites);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [syncError, setSyncError] = useState("");
  const loadedUid = useRef<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  // ---------- local: 다른 탭에서 로그인·로그아웃하거나 데이터를 바꾸면 따라간다 ----------
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === GUEST_STORAGE_KEY) setGuestFavorites(readGuestFavorites());
      if (!cloud && event.key.startsWith("campuse:v1:")) {
        const next = currentUser();
        setUser(next);
        setData(next ? readAccountData(next.id) : sanitizeData(null));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cloud]);

  // ---------- cloud: Supabase 로그인 상태를 따라간다 ----------
  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;

    const signedOut = () => {
      loadedUid.current = null;
      setUser(null);
      setEmail("");
      setIsAdmin(false);
      setSuspended(false);
      setData(sanitizeData(null));
    };

    const load = async (uid: string, mail: string) => {
      if (loadedUid.current === uid) return;
      loadedUid.current = uid;
      try {
        const [profile, saved] = await Promise.all([remote.getProfile(), remote.getUserData()]);
        if (cancelled || loadedUid.current !== uid) return;
        let next = saved ?? sanitizeData(null);
        if (localStorage.getItem(IMPORT_FLAG)) {
          localStorage.removeItem(IMPORT_FLAG);
          next = mergeData(next, { favorites: readGuestFavorites(), collections: [] });
          await remote.saveUserData(uid, next);
        }
        setUser({ id: uid, username: profile?.nickname ?? mail });
        setEmail(mail);
        setIsAdmin(Boolean(profile?.isAdmin));
        setSuspended(Boolean(profile?.suspended));
        setData(next);
        setSyncError("");
      } catch (e) {
        if (cancelled) return;
        // 서버 스키마를 아직 만들지 않았거나 네트워크 오류: 로그인은 유지하고 안내한다.
        setUser({ id: uid, username: mail });
        setEmail(mail);
        setSyncError(friendlyError(e));
      }
    };

    const { data: sub } = cloud.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      // 콜백 안에서 Supabase 를 바로 부르면 잠금이 걸릴 수 있어 다음 차례로 미룬다. (공식 문서 권고)
      window.setTimeout(() => {
        if (cancelled) return;
        if (!session?.user) signedOut();
        else if (event === "USER_UPDATED") {
          loadedUid.current = null;
          void load(session.user.id, session.user.email ?? "");
        } else void load(session.user.id, session.user.email ?? "");
      }, 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [cloud]);

  const signIn = useCallback((next: PublicUser) => {
    setUser(next);
    setData(readAccountData(next.id));
  }, []);

  const commit = useCallback(
    (update: (current: UserData) => UserData) => {
      if (!user) return;
      setData((current) => {
        const next = update(current);
        if (cloud) {
          // 빠르게 여러 번 바꾸면 마지막 상태만 저장한다.
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => {
            remote
              .saveUserData(user.id, next)
              .then(() => setSyncError(""))
              .catch((e: unknown) => setSyncError(friendlyError(e)));
          }, SAVE_DELAY);
        } else {
          writeAccountData(user.id, next);
        }
        return next;
      });
    },
    [user, cloud],
  );

  const value = useMemo<SessionValue>(() => {
    const favoriteIds = new Set(user ? data.favorites : guestFavorites);

    return {
      backend,
      user,
      email,
      isAdmin,
      suspended,
      recovery,
      syncError,
      favoriteIds,
      collections: user ? data.collections : [],
      guestFavoriteCount: guestFavorites.length,

      authMode,
      openAuth: (mode = "login") => setAuthMode(mode),
      closeAuth: () => {
        setAuthMode(null);
        setRecovery(false);
      },
      accountOpen,
      openAccount: () => setAccountOpen(true),
      closeAccount: () => setAccountOpen(false),

      login: async (username, password, remember) => {
        if (cloud) {
          const { error } = await cloud.auth.signInWithPassword({ email: username.trim(), password });
          if (error) throw new AuthError(friendlyError(error));
        } else {
          signIn(await loginUser(username, password, remember));
        }
        setAuthMode(null);
      },
      register: async (input, { importGuestFavorites, remember }) => {
        const created = await registerUser(input);
        startSession(created.id, remember);
        if (importGuestFavorites) writeAccountData(created.id, { favorites: guestFavorites, collections: [] });
        signIn(created);
        setAuthMode(null);
      },
      cloudSignUp: async ({ email: mail, password, nickname, importGuestFavorites }) => {
        if (!cloud) throw new AuthError("Supabase 가 설정되지 않았습니다.");
        const problem = await remote.checkNickname(nickname);
        if (problem) throw new AuthError(problem);
        if (importGuestFavorites) localStorage.setItem(IMPORT_FLAG, "1");
        const { data: result, error } = await cloud.auth.signUp({
          email: mail.trim(),
          password,
          options: { data: { nickname: nickname.trim() }, emailRedirectTo: siteUrl() },
        });
        if (error) {
          localStorage.removeItem(IMPORT_FLAG);
          throw new AuthError(friendlyError(error));
        }
        // 이메일 인증을 켜 둔 프로젝트는 세션 없이 돌아온다.
        if (!result.session) return "confirm";
        setAuthMode(null);
        return "done";
      },
      cloudRequestReset: async (mail) => {
        if (!cloud) return;
        const { error } = await cloud.auth.resetPasswordForEmail(mail.trim(), { redirectTo: siteUrl() });
        if (error) throw new AuthError(friendlyError(error));
      },
      cloudUpdatePassword: async (password) => {
        if (!cloud) return;
        const { error } = await cloud.auth.updateUser({ password });
        if (error) throw new AuthError(friendlyError(error));
        setRecovery(false);
        setAuthMode(null);
      },
      changeNickname: async (nickname) => {
        await remote.setNickname(nickname.trim());
        setUser((u) => (u ? { ...u, username: nickname.trim() } : u));
      },
      logout: () => {
        if (cloud) {
          void cloud.auth.signOut();
        } else {
          logoutUser();
          setUser(null);
          setData(sanitizeData(null));
        }
        setAccountOpen(false);
      },
      removeAccount: async (password) => {
        if (!user) throw new AuthError("로그인이 필요합니다.");
        if (cloud) {
          // 다른 사람이 열어 둔 화면에서 지우지 못하게 비밀번호를 다시 확인한다.
          const { error } = await cloud.auth.signInWithPassword({ email, password });
          if (error) throw new AuthError(friendlyError(error));
          await remote.deleteAccount();
          await cloud.auth.signOut();
        } else {
          await deleteLocalAccount(user.id, password);
          setUser(null);
          setData(sanitizeData(null));
        }
        setAccountOpen(false);
      },

      toggleFavorite: (placeId) => {
        if (user) {
          commit((d) => ({ ...d, favorites: toggleIn(d.favorites, placeId) }));
        } else {
          setGuestFavorites((current) => {
            const next = toggleIn(current, placeId);
            writeGuestFavorites(next);
            return next;
          });
        }
      },
      createCollection: (name, placeId) => {
        const clean = name.trim().slice(0, MAX_COLLECTION_NAME);
        if (!user || !clean || data.collections.length >= MAX_COLLECTIONS) return null;
        const existing = data.collections.find((c) => c.name === clean);
        if (existing) {
          if (placeId) commit((d) => ({ ...d, collections: d.collections.map((c) => (c.id === existing.id && !c.placeIds.includes(placeId) ? { ...c, placeIds: [...c.placeIds, placeId] } : c)) }));
          return existing.id;
        }
        const id = newCollectionId();
        commit((d) => ({ ...d, collections: [...d.collections, { id, name: clean, placeIds: placeId ? [placeId] : [] }] }));
        return id;
      },
      renameCollection: (id, name) => {
        const clean = name.trim().slice(0, MAX_COLLECTION_NAME);
        if (!clean) return;
        commit((d) => ({ ...d, collections: d.collections.map((c) => (c.id === id ? { ...c, name: clean } : c)) }));
      },
      deleteCollection: (id) => commit((d) => ({ ...d, collections: d.collections.filter((c) => c.id !== id) })),
      toggleInCollection: (collectionId, placeId) =>
        commit((d) => ({
          ...d,
          collections: d.collections.map((c) => (c.id === collectionId ? { ...c, placeIds: toggleIn(c.placeIds, placeId) } : c)),
        })),

      exportData: () => data,
      importData: (raw) => {
        const incoming = sanitizeData(raw);
        commit((d) => mergeData(d, incoming));
        return { favorites: incoming.favorites.length, collections: incoming.collections.length };
      },
      importGuestFavorites: () => {
        commit((d) => mergeData(d, { favorites: guestFavorites, collections: [] }));
        return guestFavorites.length;
      },
    };
  }, [backend, cloud, user, email, isAdmin, suspended, recovery, syncError, data, guestFavorites, authMode, accountOpen, signIn, commit]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

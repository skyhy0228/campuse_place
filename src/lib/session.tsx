import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AuthError,
  currentUser,
  deleteAccount,
  loginUser,
  logoutUser,
  registerUser,
  startSession,
  type PublicUser,
  type RegisterInput,
} from "./auth";
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

interface SessionValue {
  user: PublicUser | null;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(currentUser);
  const [data, setData] = useState<UserData>(() => (user ? readAccountData(user.id) : sanitizeData(null)));
  const [guestFavorites, setGuestFavorites] = useState<string[]>(readGuestFavorites);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  // 다른 탭에서 로그인·로그아웃하거나 데이터를 바꾸면 따라간다.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === GUEST_STORAGE_KEY) setGuestFavorites(readGuestFavorites());
      if (event.key.startsWith("campuse:v1:")) {
        const next = currentUser();
        setUser(next);
        setData(next ? readAccountData(next.id) : sanitizeData(null));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback((next: PublicUser) => {
    setUser(next);
    setData(readAccountData(next.id));
  }, []);

  const commit = useCallback(
    (update: (current: UserData) => UserData) => {
      if (!user) return;
      setData((current) => {
        const next = update(current);
        writeAccountData(user.id, next);
        return next;
      });
    },
    [user],
  );

  const value = useMemo<SessionValue>(() => {
    const favoriteIds = new Set(user ? data.favorites : guestFavorites);

    return {
      user,
      favoriteIds,
      collections: user ? data.collections : [],
      guestFavoriteCount: guestFavorites.length,

      authMode,
      openAuth: (mode = "login") => setAuthMode(mode),
      closeAuth: () => setAuthMode(null),
      accountOpen,
      openAccount: () => setAccountOpen(true),
      closeAccount: () => setAccountOpen(false),

      login: async (username, password, remember) => {
        signIn(await loginUser(username, password, remember));
        setAuthMode(null);
      },
      register: async (input, { importGuestFavorites, remember }) => {
        const created = await registerUser(input);
        startSession(created.id, remember);
        if (importGuestFavorites) writeAccountData(created.id, { favorites: guestFavorites, collections: [] });
        signIn(created);
        setAuthMode(null);
      },
      logout: () => {
        logoutUser();
        setUser(null);
        setData(sanitizeData(null));
        setAccountOpen(false);
      },
      removeAccount: async (password) => {
        if (!user) throw new AuthError("로그인이 필요합니다.");
        await deleteAccount(user.id, password);
        setUser(null);
        setData(sanitizeData(null));
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
  }, [user, data, guestFavorites, authMode, accountOpen, signIn, commit]);


  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

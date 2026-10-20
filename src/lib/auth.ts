// 브라우저 안에서만 동작하는 계정 기능.
// - 서버가 없는 정적 사이트라 계정 정보는 이 브라우저의 localStorage 에만 저장된다. (다른 기기와 동기화되지 않음)
// - 비밀번호와 비밀번호 찾기 답변은 솔트를 붙여 PBKDF2-SHA256 으로 해시해 저장하고, 원문은 저장하지 않는다.
//   그래서 비밀번호를 '알려줄' 수는 없고, 질문에 맞게 답하면 새 비밀번호를 설정할 수 있다.
// - 같은 기기를 쓰는 사람이 개발자 도구로 저장소를 직접 열어보는 것까지는 막을 수 없다. 개인 목록을 구분하는 용도다.

const USERS_KEY = "campuse:v1:users";
const SESSION_KEY = "campuse:v1:session";
const THROTTLE_KEY = "campuse:v1:throttle";
const ITERATIONS = 210_000;

export interface PublicUser {
  id: string;
  username: string;
}

interface StoredUser extends PublicUser {
  salt: string;
  hash: string;
  iterations: number;
  question: string;
  answerSalt: string;
  answerHash: string;
  createdAt: number;
}

export class AuthError extends Error {}

// ---------- 저장소 ----------
function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    throw new AuthError("브라우저 저장소를 사용할 수 없습니다. 사생활 보호 모드나 저장소 차단 설정을 확인하세요.");
  }
}

const readUsers = () => readJson<StoredUser[]>(localStorage, USERS_KEY, []);
const writeUsers = (users: StoredUser[]) => writeJson(localStorage, USERS_KEY, users);

// ---------- 해시 ----------
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

const randomSalt = () => toBase64(crypto.getRandomValues(new Uint8Array(16)));

async function derive(secret: string, salt: string, iterations: number) {
  if (!crypto?.subtle) throw new AuthError("이 환경에서는 계정 기능을 쓸 수 없습니다. HTTPS 주소로 접속하세요.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

// 길이가 같으면 모든 글자를 비교해 비교 시간이 내용에 따라 달라지지 않게 한다.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 답변은 대소문자·공백 차이로 틀리지 않게 정규화한 뒤 해시한다.
export const normalizeAnswer = (answer: string) => answer.normalize("NFC").toLowerCase().replace(/\s+/g, "");

// ---------- 입력 검사 ----------
export const USERNAME_RULE = "영문 소문자·숫자·밑줄(_) 4~20자";
export const PASSWORD_RULE = "영문과 숫자를 모두 포함해 8자 이상";

export function validateUsername(raw: string) {
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{4,20}$/.test(username)) throw new AuthError(`아이디는 ${USERNAME_RULE}로 입력하세요.`);
  return username;
}

export function validatePassword(password: string, username = "") {
  if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AuthError(`비밀번호는 ${PASSWORD_RULE}이어야 합니다 (최대 64자).`);
  }
  if (username && password.toLowerCase().includes(username)) throw new AuthError("비밀번호에 아이디를 포함할 수 없습니다.");
}

// ---------- 시도 횟수 제한 ----------
// 틀린 횟수가 5번을 넘으면 잠시 막는다. 브라우저 안의 제한이라 우회할 수는 있지만, 실수로 반복 입력하는 것을 줄인다.
interface Throttle {
  fails: number;
  lockedUntil: number;
}

function checkThrottle(key: string) {
  const entry = readJson<Record<string, Throttle>>(localStorage, THROTTLE_KEY, {})[key];
  if (entry && entry.lockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw new AuthError(`시도 횟수가 많습니다. ${seconds}초 뒤에 다시 시도하세요.`);
  }
}

function recordFailure(key: string) {
  const all = readJson<Record<string, Throttle>>(localStorage, THROTTLE_KEY, {});
  const fails = (all[key]?.fails ?? 0) + 1;
  const lockSeconds = fails >= 5 ? Math.min(30 * 2 ** (fails - 5), 900) : 0;
  all[key] = { fails, lockedUntil: lockSeconds ? Date.now() + lockSeconds * 1000 : 0 };
  writeJson(localStorage, THROTTLE_KEY, all);
}

function clearFailures(key: string) {
  const all = readJson<Record<string, Throttle>>(localStorage, THROTTLE_KEY, {});
  if (key in all) {
    delete all[key];
    writeJson(localStorage, THROTTLE_KEY, all);
  }
}

// ---------- 계정 ----------
const toPublic = ({ id, username }: StoredUser): PublicUser => ({ id, username });

export interface RegisterInput {
  username: string;
  password: string;
  question: string;
  answer: string;
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const username = validateUsername(input.username);
  validatePassword(input.password, username);
  const question = input.question.trim();
  if (question.length < 2 || question.length > 60) throw new AuthError("비밀번호 찾기 질문은 2~60자로 입력하세요.");
  const answer = normalizeAnswer(input.answer);
  if (answer.length < 2 || answer.length > 60) throw new AuthError("답변은 2~60자로 입력하세요.");

  const users = readUsers();
  if (users.some((u) => u.username === username)) throw new AuthError("이미 사용 중인 아이디입니다.");

  const salt = randomSalt();
  const answerSalt = randomSalt();
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    salt,
    hash: await derive(input.password, salt, ITERATIONS),
    iterations: ITERATIONS,
    question,
    answerSalt,
    answerHash: await derive(answer, answerSalt, ITERATIONS),
    createdAt: Date.now(),
  };
  // 해시를 계산하는 동안 같은 아이디가 생기지 않았는지 한 번 더 확인한다.
  const latest = readUsers();
  if (latest.some((u) => u.username === username)) throw new AuthError("이미 사용 중인 아이디입니다.");
  writeUsers([...latest, user]);
  return toPublic(user);
}

const LOGIN_FAILED = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function loginUser(rawUsername: string, password: string, remember: boolean): Promise<PublicUser> {
  const username = rawUsername.trim().toLowerCase();
  const throttleKey = `login:${username}`;
  checkThrottle(throttleKey);

  const user = readUsers().find((u) => u.username === username);
  // 아이디가 없어도 같은 계산을 해서 응답 시간으로 계정 존재 여부를 알아내기 어렵게 한다.
  const hash = await derive(password, user?.salt ?? randomSalt(), user?.iterations ?? ITERATIONS);
  if (!user || !safeEqual(hash, user.hash)) {
    recordFailure(throttleKey);
    throw new AuthError(LOGIN_FAILED);
  }
  clearFailures(throttleKey);
  startSession(user.id, remember);
  return toPublic(user);
}

export function startSession(userId: string, remember: boolean) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  writeJson(remember ? localStorage : sessionStorage, SESSION_KEY, { userId });
}

export function currentUser(): PublicUser | null {
  const session =
    readJson<{ userId?: string }>(sessionStorage, SESSION_KEY, {}).userId ??
    readJson<{ userId?: string }>(localStorage, SESSION_KEY, {}).userId;
  const user = readUsers().find((u) => u.id === session);
  return user ? toPublic(user) : null;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSecurityQuestion(rawUsername: string): string {
  const user = readUsers().find((u) => u.username === rawUsername.trim().toLowerCase());
  if (!user) throw new AuthError("해당 아이디를 찾을 수 없습니다.");
  return user.question;
}

// 질문에 맞게 답하면 새 비밀번호로 바꾼다. 기존 비밀번호는 해시로만 저장돼 있어 보여줄 수 없다.
export async function resetPassword(rawUsername: string, answer: string, newPassword: string) {
  const username = rawUsername.trim().toLowerCase();
  const throttleKey = `reset:${username}`;
  checkThrottle(throttleKey);

  const users = readUsers();
  const user = users.find((u) => u.username === username);
  if (!user) throw new AuthError("해당 아이디를 찾을 수 없습니다.");
  validatePassword(newPassword, username);

  const hash = await derive(normalizeAnswer(answer), user.answerSalt, user.iterations);
  if (!safeEqual(hash, user.answerHash)) {
    recordFailure(throttleKey);
    throw new AuthError("답변이 일치하지 않습니다.");
  }
  clearFailures(throttleKey);
  clearFailures(`login:${username}`);

  const salt = randomSalt();
  user.salt = salt;
  user.iterations = ITERATIONS;
  user.hash = await derive(newPassword, salt, ITERATIONS);
  writeUsers(users.map((u) => (u.id === user.id ? user : u)));
}

export async function deleteAccount(userId: string, password: string) {
  const user = readUsers().find((u) => u.id === userId);
  if (!user) throw new AuthError("계정을 찾을 수 없습니다.");
  const throttleKey = `delete:${user.username}`;
  checkThrottle(throttleKey);
  if (!safeEqual(await derive(password, user.salt, user.iterations), user.hash)) {
    recordFailure(throttleKey);
    throw new AuthError("비밀번호가 올바르지 않습니다.");
  }
  clearFailures(throttleKey);
  writeUsers(readUsers().filter((u) => u.id !== userId));
  localStorage.removeItem(`campuse:v1:data:${userId}`);
  logoutUser();
}

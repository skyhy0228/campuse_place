import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PASSWORD_RULE, USERNAME_RULE, getSecurityQuestion, resetPassword } from "../lib/auth";
import { useSession, type AuthMode } from "../lib/session";
import { Modal } from "./Modal";

const QUESTIONS = [
  "초등학교 때 가장 친했던 친구의 이름은?",
  "처음 키운 반려동물의 이름은?",
  "가장 기억에 남는 여행지는?",
  "어린 시절 살던 동네 이름은?",
  "가장 좋아하는 책 제목은?",
];
const CUSTOM = "직접 입력";

const TABS: { mode: AuthMode; label: string }[] = [
  { mode: "login", label: "로그인" },
  { mode: "signup", label: "회원가입" },
  { mode: "reset", label: "비밀번호 찾기" },
];

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function LoginForm({ onSwitch, initialUsername }: { onSwitch: (mode: AuthMode) => void; initialUsername: string }) {
  const { login } = useSession();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password, remember);
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="authForm">
      <Field id="login-username" label="아이디">
        <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus={!initialUsername} />
      </Field>
      <Field id="login-password" label="비밀번호">
        <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus={Boolean(initialUsername)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        로그인 유지
      </label>
      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="authLinks">
        <button type="button" className="linkButton" onClick={() => onSwitch("reset")}>
          비밀번호를 잊으셨나요?
        </button>
        <button type="button" className="linkButton" onClick={() => onSwitch("signup")}>
          회원가입
        </button>
      </p>
    </form>
  );
}

function SignupForm() {
  const { register, guestFavoriteCount } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [importGuest, setImportGuest] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await register(
        { username, password, question: question === CUSTOM ? customQuestion : question, answer },
        { importGuestFavorites: importGuest && guestFavoriteCount > 0, remember: true },
      );
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="authForm">
      <Field id="signup-username" label="아이디" hint={USERNAME_RULE}>
        <input id="signup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      </Field>
      <Field id="signup-password" label="비밀번호" hint={PASSWORD_RULE}>
        <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field id="signup-confirm" label="비밀번호 확인">
        <input id="signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field id="signup-question" label="비밀번호 찾기 질문" hint="비밀번호를 잊었을 때 이 질문에 답하면 새 비밀번호를 정할 수 있습니다.">
        <select id="signup-question" value={question} onChange={(e) => setQuestion(e.target.value)}>
          {[...QUESTIONS, CUSTOM].map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
      </Field>
      {question === CUSTOM && (
        <Field id="signup-custom-question" label="직접 입력한 질문">
          <input id="signup-custom-question" value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} maxLength={60} required />
        </Field>
      )}
      <Field id="signup-answer" label="질문의 답" hint="다른 사람이 쉽게 짐작하기 어려운 답을 쓰세요. 대소문자와 띄어쓰기는 구분하지 않습니다.">
        <input id="signup-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={60} autoComplete="off" required />
      </Field>
      {guestFavoriteCount > 0 && (
        <label className="check">
          <input type="checkbox" checked={importGuest} onChange={(e) => setImportGuest(e.target.checked)} />
          이 기기의 즐겨찾기 {guestFavoriteCount}곳을 내 계정으로 가져오기
        </label>
      )}
      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? "만드는 중…" : "회원가입"}
      </button>
    </form>
  );
}

function ResetForm({ onDone }: { onDone: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const findQuestion = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      setQuestion(getSecurityQuestion(username));
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const reset = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(username, answer, password);
      onDone(username.trim().toLowerCase());
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  if (!question) {
    return (
      <form onSubmit={findQuestion} className="authForm">
        <p className="hint">가입할 때 정한 질문에 답하면 새 비밀번호를 설정할 수 있습니다. (기존 비밀번호는 암호화되어 저장되므로 보여드릴 수 없습니다.)</p>
        <Field id="reset-username" label="아이디">
          <input id="reset-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
        </Field>
        {error && (
          <p className="formError" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary">
          다음
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={reset} className="authForm">
      <p className="questionBox">
        <span className="hint">질문</span>
        <strong>{question}</strong>
      </p>
      <Field id="reset-answer" label="질문의 답">
        <input id="reset-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" required autoFocus />
      </Field>
      <Field id="reset-password" label="새 비밀번호" hint={PASSWORD_RULE}>
        <input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field id="reset-confirm" label="새 비밀번호 확인">
        <input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        {busy ? "확인 중…" : "비밀번호 재설정"}
      </button>
    </form>
  );
}

export function AuthDialog() {
  const { authMode, closeAuth, openAuth } = useSession();
  const [notice, setNotice] = useState("");
  const [loginName, setLoginName] = useState("");
  if (!authMode) return null;

  const switchTo = (mode: AuthMode) => {
    setNotice("");
    openAuth(mode);
  };

  return (
    <Modal labelledBy="authTitle" onClose={closeAuth} className="authDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <h2 id="authTitle">{TABS.find((t) => t.mode === authMode)?.label}</h2>
          <button type="button" className="iconButton" onClick={closeAuth} aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="tabs" role="group" aria-label="계정 메뉴">
          {TABS.map((tab) => (
            <button key={tab.mode} type="button" aria-pressed={authMode === tab.mode} onClick={() => switchTo(tab.mode)}>
              {tab.label}
            </button>
          ))}
        </div>
        {notice && (
          <p className="formNotice" role="status">
            {notice}
          </p>
        )}
        {authMode === "login" && <LoginForm onSwitch={switchTo} initialUsername={loginName} />}
        {authMode === "signup" && <SignupForm />}
        {authMode === "reset" && (
          <ResetForm
            onDone={(username) => {
              setLoginName(username);
              setNotice("비밀번호를 바꿨습니다. 새 비밀번호로 로그인하세요.");
              openAuth("login");
            }}
          />
        )}
        <p className="privacyNote">
          계정은 <strong>이 브라우저에만</strong> 저장되며 다른 기기와 자동으로 연결되지 않습니다. 비밀번호는 암호화되어 저장됩니다. 다른 기기에서는 내 계정 화면의 &lsquo;내보내기·가져오기&rsquo;를 쓰세요.
        </p>
      </div>
    </Modal>
  );
}

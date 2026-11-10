// Supabase 이메일 계정의 로그인·회원가입·비밀번호 재설정 화면 (Supabase 키가 있을 때만 쓴다)
import { X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { validatePassword } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { useSession, type AuthMode } from "../lib/session";
import { Modal } from "./Modal";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, submit };
}

function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="formError" role="alert">
      {error}
    </p>
  ) : null;
}

function LoginForm({ onSwitch }: { onSwitch: (mode: AuthMode) => void }) {
  const { t } = useLang();
  const s = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(() => s.login(email, password, true));
  return (
    <form className="authForm" onSubmit={submit}>
      <Field id="cloud-email" label={t.authEmail}>
        <input id="cloud-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <Field id="cloud-password" label={t.authPassword}>
        <input id="cloud-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <ErrorText error={error} />
      <button type="submit" className="button primary" disabled={busy}>
        {t.authSubmitLogin}
      </button>
      <div className="authLinks">
        <button type="button" className="linkButton" onClick={() => onSwitch("reset")}>
          {t.authForgot}
        </button>
        <button type="button" className="linkButton" onClick={() => onSwitch("signup")}>
          {t.authNoAccount}
        </button>
      </div>
    </form>
  );
}

function SignupForm({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useLang();
  const s = useSession();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [importGuest, setImportGuest] = useState(true);
  const { busy, error, submit } = useSubmit(async () => {
    validatePassword(password);
    if (password !== confirm) throw new Error(t.authPasswordMismatch);
    const result = await s.cloudSignUp({ email, password, nickname, importGuestFavorites: importGuest && s.guestFavoriteCount > 0 });
    if (result === "confirm") onSent(email);
  });
  return (
    <form className="authForm" onSubmit={submit}>
      <Field id="signup-email" label={t.authEmail}>
        <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <Field id="signup-nickname" label={t.authNickname} hint={t.authNicknameHint}>
        <input id="signup-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={12} required aria-describedby="signup-nickname-hint" />
      </Field>
      <Field id="signup-password" label={t.authPassword} hint={t.authPasswordRule}>
        <input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required aria-describedby="signup-password-hint" />
      </Field>
      <Field id="signup-confirm" label={t.authPasswordConfirm}>
        <input id="signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      {s.guestFavoriteCount > 0 && (
        <label className="check">
          <input type="checkbox" checked={importGuest} onChange={(e) => setImportGuest(e.target.checked)} />
          {t.authImportGuest(s.guestFavoriteCount)}
        </label>
      )}
      <ErrorText error={error} />
      <button type="submit" className="button primary" disabled={busy}>
        {t.authSubmitSignup}
      </button>
      <p className="privacyNote">{t.authPrivacy}</p>
    </form>
  );
}

function ResetForm({ onSent }: { onSent: () => void }) {
  const { t } = useLang();
  const s = useSession();
  const [email, setEmail] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    await s.cloudRequestReset(email);
    onSent();
  });
  return (
    <form className="authForm" onSubmit={submit}>
      <Field id="reset-email" label={t.authEmail}>
        <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <ErrorText error={error} />
      <button type="submit" className="button primary" disabled={busy}>
        {t.authSubmitReset}
      </button>
    </form>
  );
}

function NewPasswordForm() {
  const { t } = useLang();
  const s = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    validatePassword(password);
    if (password !== confirm) throw new Error(t.authPasswordMismatch);
    await s.cloudUpdatePassword(password);
  });
  return (
    <form className="authForm" onSubmit={submit}>
      <Field id="new-password" label={t.authPassword} hint={t.authPasswordRule}>
        <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus aria-describedby="new-password-hint" />
      </Field>
      <Field id="new-confirm" label={t.authPasswordConfirm}>
        <input id="new-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      <ErrorText error={error} />
      <button type="submit" className="button primary" disabled={busy}>
        {t.authSubmitNewPassword}
      </button>
    </form>
  );
}

export function CloudAuthDialog() {
  const { t } = useLang();
  const s = useSession();
  const [notice, setNotice] = useState("");
  if (!s.authMode && !s.recovery) return null;

  const tabs: { mode: AuthMode; label: string }[] = [
    { mode: "login", label: t.authLogin },
    { mode: "signup", label: t.authSignup },
    { mode: "reset", label: t.authReset },
  ];
  const switchTo = (mode: AuthMode) => {
    setNotice("");
    s.openAuth(mode);
  };
  const title = s.recovery ? t.authNewPassword : (tabs.find((tab) => tab.mode === s.authMode)?.label ?? t.authLogin);

  return (
    <Modal labelledBy="authTitle" onClose={s.closeAuth} className="authDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <h2 id="authTitle">{title}</h2>
          <button type="button" className="iconButton" onClick={s.closeAuth} aria-label={t.close}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {!s.recovery && (
          <div className="tabs" role="group" aria-label={t.authMenu}>
            {tabs.map((tab) => (
              <button key={tab.mode} type="button" aria-pressed={s.authMode === tab.mode} onClick={() => switchTo(tab.mode)}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {notice && (
          <p className="formNotice" role="status">
            {notice}
          </p>
        )}
        {s.recovery ? (
          <NewPasswordForm />
        ) : s.authMode === "signup" ? (
          <SignupForm
            onSent={(mail) => {
              setNotice(t.authConfirmSent(mail));
              s.openAuth("login");
            }}
          />
        ) : s.authMode === "reset" ? (
          <ResetForm onSent={() => setNotice(t.authResetSent)} />
        ) : (
          <LoginForm onSwitch={switchTo} />
        )}
      </div>
    </Modal>
  );
}

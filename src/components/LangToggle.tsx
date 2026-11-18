import { useEffect, useRef, useState } from "react";
import { DICTS, LANGS, htmlLang, useLang, type Lang } from "../lib/i18n";

// 한국어 / 中文(유학생 모드) / English 고르기. 버튼에는 지금 언어를 짧게 보여주고, 누르면 세 언어를 각 언어로 보여준다.
const SHORT: Record<Lang, string> = { ko: "한국어", zh: "中文", en: "EN" };
const NAME = (lang: Lang) => ({ ko: DICTS.ko.langKo, zh: DICTS.zh.langZh, en: DICTS.en.langEn })[lang];

export function LangToggle() {
  const { lang, t, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: Lang) => {
    setLang(next);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="langMenu" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="langToggle"
        aria-expanded={open}
        aria-controls="langList"
        // 버튼에 보이는 글자(EN 등)가 접근 가능한 이름에 들어 있어야 음성 명령으로도 누를 수 있다. (괄호 속 글자는 이름으로 치지 않는다)
        aria-label={`${t.langLabel}: ${NAME(lang)}${SHORT[lang] !== NAME(lang) ? ` · ${SHORT[lang]}` : ""}`}
        title={t.langLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span lang={htmlLang(lang)}>{SHORT[lang]}</span>
      </button>
      {open && (
        <ul id="langList" className="langList" aria-label={t.langLabel}>
          {LANGS.map((item) => (
            <li key={item}>
              <button type="button" lang={htmlLang(item)} aria-current={item === lang ? "true" : undefined} onClick={() => choose(item)}>
                {NAME(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

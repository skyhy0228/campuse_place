import { useLang } from "../lib/i18n";

// 한국어 ↔ 中文(유학생 모드) 전환. 버튼에는 바꿀 언어 이름을 그 언어로 보여준다.
export function LangToggle() {
  const { lang, t, setLang } = useLang();
  const next = lang === "ko" ? "zh" : "ko";
  const nextLabel = next === "zh" ? t.langZh : t.langKo;
  const current = lang === "zh" ? t.langZh : t.langKo;
  return (
    <button
      type="button"
      className="langToggle"
      lang={next === "zh" ? "zh-CN" : "ko"}
      onClick={() => setLang(next)}
      aria-label={`${t.langLabel}: ${current} → ${nextLabel}`}
      title={`${t.langLabel}: ${current}`}
    >
      {nextLabel}
    </button>
  );
}

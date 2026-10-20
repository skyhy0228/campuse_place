import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getTheme, nextTheme, saveTheme, type Theme } from "../lib/theme";

const LABEL: Record<Theme, string> = { auto: "자동", light: "밝게", dark: "어둡게" };

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme);

  // 기기 설정이 바뀌면 '자동' 모드의 상단바 색도 맞춘다.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(getTheme());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const Icon = theme === "auto" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <button
      type="button"
      className="iconButton"
      onClick={() => {
        const next = nextTheme(theme);
        saveTheme(next);
        setTheme(next);
      }}
      aria-label={`화면 테마: ${LABEL[theme]} (누르면 ${LABEL[nextTheme(theme)]}으로 변경)`}
      title={`화면 테마: ${LABEL[theme]}`}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

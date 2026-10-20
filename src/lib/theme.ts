export type Theme = "auto" | "light" | "dark";

const KEY = "campuse:theme";
const ORDER: Theme[] = ["auto", "light", "dark"];

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    return ORDER.includes(saved as Theme) ? (saved as Theme) : "auto";
  } catch {
    return "auto";
  }
}

// 'auto'는 기기의 밝은/어두운 화면 설정을 따른다.
export function applyTheme(theme: Theme) {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#17191c" : "#f6f4ef");
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // 저장소를 쓸 수 없으면 현재 화면에만 적용한다.
  }
  applyTheme(theme);
}

export const nextTheme = (theme: Theme): Theme => ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

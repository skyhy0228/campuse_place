// 링크 공유: 기기 공유 창이 있으면 그것을, 없으면 클립보드 복사를, 그것도 안 되면 직접 복사하게 보여준다.
export type ShareResult = "shared" | "copied" | "prompted" | "cancelled";

export async function shareLink(url: string, title: string, promptText: string): Promise<ShareResult> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    window.prompt(promptText, url);
    return "prompted";
  }
}

// 지금 사이트의 기본 주소 (쿼리·해시 없이)
export const siteBase = () => `${location.origin}${location.pathname}`;

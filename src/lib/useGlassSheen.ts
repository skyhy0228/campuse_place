import { useEffect } from "react";

// 유리 면(.glass) 위에서 마우스를 움직이면 반사광(--mx, --my)이 따라오게 한다. (교통여지도 glass.js 의 반사광 부분)
// 정밀 포인터(마우스)에서만 쓰고, '동작 줄이기' 설정이면 끈다. 굴절(SVG 필터)은 크롬 전용이라 옮기지 않았다.
export function useGlassSheen() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    let frame = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target = (event.target as Element | null)?.closest?.<HTMLElement>(".glass") ?? null;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const apply = () => {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const clamp = (v: number) => Math.max(-25, Math.min(125, v));
      target.style.setProperty("--mx", `${clamp(((x - rect.left) / rect.width) * 100)}%`);
      target.style.setProperty("--my", `${clamp(((y - rect.top) / rect.height) * 100)}%`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import "./styles.css";

applyTheme(getTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 배포 환경에서만 서비스 워커를 등록한다. (개발 서버에서는 오래된 화면이 남지 않게 등록하지 않는다)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 등록에 실패해도 사이트는 그대로 동작한다.
    });
  });
}

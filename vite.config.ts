import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages 프로젝트 사이트(https://skyhy0228.github.io/campuse_place/) 경로에 맞춘다.
// 다른 경로에 배포할 때는 VITE_BASE 환경 변수로 바꾼다.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/campuse_place/",
  plugins: [react()],
});

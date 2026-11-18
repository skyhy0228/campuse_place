// 브라우저 테스트(tests/e2e)용 빌드 두 가지를 만든다. 실제 키·서버에는 연결하지 않는다.
// - dist/       : 가짜 카카오 지도 키. 테스트가 카카오 지도 SDK 를 가짜 스크립트로 바꿔 끼운다 (tests/e2e/helpers.mjs).
// - dist-cloud/ : 위에 더해 가짜 Supabase 주소. 테스트가 그 주소로 가는 요청을 가로채 정해 둔 응답을 돌려준다.
// 이미 있는 환경 변수가 .env 파일보다 우선하므로, 여기서 넣은 가짜 값이 쓰인다.
import { build } from "vite";

process.env.VITE_KAKAO_MAP_KEY = "e2e-fake-kakao-key";
await build({ mode: "e2e", logLevel: "warn", build: { outDir: "dist", emptyOutDir: true } });
console.log("dist 빌드 완료 (가짜 지도 키)");

process.env.VITE_SUPABASE_URL = "https://e2e.supabase.test";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2e_fake";
await build({ mode: "e2e", logLevel: "warn", build: { outDir: "dist-cloud", emptyOutDir: true } });
console.log("dist-cloud 빌드 완료 (가짜 지도 키 + 가짜 Supabase 주소)");

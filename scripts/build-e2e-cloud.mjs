// Supabase 기능 브라우저 테스트(tests/e2e/cloud.test.mjs)용 빌드. 가짜 Supabase 주소를 넣어 dist-cloud/ 에 만든다.
// 테스트는 이 주소로 가는 요청을 Playwright 로 가로채 정해 둔 응답을 돌려준다. (실제 Supabase 에는 연결하지 않는다)
import { build } from "vite";

process.env.VITE_SUPABASE_URL = "https://e2e.supabase.test";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2e_fake";

await build({ mode: "e2e", logLevel: "warn", build: { outDir: "dist-cloud", emptyOutDir: true } });
console.log("dist-cloud 빌드 완료 (가짜 Supabase 주소)");

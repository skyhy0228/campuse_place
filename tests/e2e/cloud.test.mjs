// Supabase 기능 브라우저 테스트. 가짜 Supabase 주소로 빌드한 dist-cloud 를 띄우고, 그 주소로 가는 요청을
// Playwright 로 가로채 정해 둔 응답을 돌려준다. 실제 Supabase(인증·RLS·함수)는 여기서 검증하지 않는다.
// 사용: npm run build:e2e 뒤 npm run test:e2e
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { cards, launchBrowser, places, settle, startServer } from "./helpers.mjs";

const SB = "https://e2e.supabase.test";
const UID = "0a1b2c3d-0000-4000-8000-000000000001";
const PASSWORD = "Passw0rd9";
const burrito = places.find((p) => p.name === "부리또인 충주교통대점");

let server;
let browser;
before(async () => {
  server = await startServer("dist-cloud");
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const accessToken = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: UID, exp, role: "authenticated", email: "tester@example.com" })}.sig`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: { provider: "email" }, user_metadata: { nickname: "테스터" }, created_at: "2026-11-01T00:00:00Z" };
const session = { access_token: accessToken, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "refresh-e2e", user };

const approved = {
  id: "11111111-2222-4333-8444-555555555555",
  nickname: "테스터",
  kind: "new",
  place_id: null,
  name: "E2E 제보 카페",
  category: "카페",
  location: "대학로 1",
  body: "테스트로 제보한 조용한 카페입니다.\n콘센트가 많아요.",
  map_url: null,
  lat: null,
  lng: null,
  photos: [],
  status: "approved",
  created_at: "2026-11-01T00:00:00Z",
  reviewed_at: "2026-11-02T00:00:00Z",
};
const pending = { ...approved, id: "99999999-2222-4333-8444-555555555555", name: "대기 중인 제보", status: "pending", reviewed_at: null, user_id: UID };

// 요청을 기록하고 가짜 응답을 돌려준다.
async function fakeSupabase(context, { admin = false } = {}) {
  const state = { rpc: [], saved: [], patches: [] };
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
  await context.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = req.postData() ? JSON.parse(req.postData()) : null;

    if (p === "/auth/v1/token") {
      if (body?.password !== PASSWORD) return json({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
      return json(session);
    }
    if (p === "/auth/v1/user") return json(user);
    if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: cors });
    if (p === "/rest/v1/review_stats") return json([{ place_id: burrito.id, n: 3, total: 15 }]);
    if (p === "/rest/v1/reviews") {
      return json([{ id: "r1", nickname: "다른학생", rating: 5, body: "양이 많고 맛있어요", created_at: "2026-11-03T00:00:00Z", user_id: "someone-else" }]);
    }
    if (p === "/rest/v1/submissions") {
      if (req.method() === "PATCH") {
        state.patches.push({ query: url.search, body });
        return json([]);
      }
      const status = url.searchParams.get("status");
      if (status === "eq.approved") return json([approved]);
      if (status === "eq.pending") return json([pending]);
      return json([]);
    }
    if (p === "/rest/v1/user_data") {
      if (req.method() === "GET") return json([]);
      state.saved.push(body);
      return json([], 201);
    }
    if (p === "/rest/v1/rpc/my_profile") return json([{ nickname: "테스터", suspended: false, is_admin: admin }]);
    if (p === "/rest/v1/rpc/nickname_check") return json(null);
    if (p.startsWith("/rest/v1/rpc/")) {
      state.rpc.push({ name: p.split("/").pop(), body });
      return json(null);
    }
    return json([]);
  });
  return state;
}

// 페이지를 열기 전에 가짜 Supabase 를 연결해야 하므로 helpers 의 withPage 대신 컨텍스트를 직접 만든다.
async function runCloud(fn, { admin = false, url = "", viewport, checkErrors = true, ready = "article.card" } = {}) {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1440, height: 900 }, locale: "ko-KR", serviceWorkers: "block" });
  const state = await fakeSupabase(context, { admin });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.goto(`http://127.0.0.1:${process.env.E2E_PORT ?? 4173}/campuse_place/${url}`);
    await page.waitForSelector(ready);
    await fn(page, state);
    if (checkErrors) assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

async function signIn(page, password = PASSWORD) {
  await page.locator(".headerActions .account").click();
  await page.getByLabel("이메일", { exact: true }).fill("tester@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.locator("dialog[open] form").getByRole("button", { name: "로그인", exact: true }).click();
}
const signedIn = (page) =>
  page.waitForFunction(() => document.querySelector(".headerActions .account")?.getAttribute("aria-label") === "내 계정 (테스터)");

describe("Supabase 연결 (가짜 서버)", () => {
  test("회원 별점이 기본 별점과 합쳐지고, 승인된 학생 제보가 목록에 나온다", () =>
    runCloud(async (page) => {
      await page.waitForFunction(() => document.querySelectorAll("article.card").length > 0);
      await page.getByRole("button", { name: "E2E 제보 카페", exact: true }).waitFor();
      assert.equal(await cards(page).count(), places.length + 1);
      // 기본 4.0 을 한 표로 치고 회원 3명(합 15) → (15 + 4) / 4 = 4.75 → 4.8
      const card = cards(page).filter({ has: page.getByRole("button", { name: burrito.name, exact: true }) });
      assert.match(await card.locator(".meta .star").innerText(), /4\.8/);
    }));

  test("이메일로 로그인한다 (틀린 비밀번호는 안내), 즐겨찾기는 서버에 저장된다", () =>
    runCloud(
      async (page, state) => {
        await signIn(page, "Wrong1234");
        assert.match(await page.locator("dialog[open] [role=alert]").innerText(), /이메일 또는 비밀번호가 맞지 않습니다/);
        await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
        await page.locator("dialog[open] form").getByRole("button", { name: "로그인", exact: true }).click();
        await signedIn(page);

        await cards(page).first().getByRole("button", { name: /즐겨찾기 추가$/ }).click();
        // 즐겨찾기는 0.6초 모았다가 저장한다.
        await settle(page, 1000);
        assert.ok(state.saved.length >= 1, "user_data 를 저장하지 않았습니다");
        assert.equal(state.saved.at(-1).user_id, UID);
        assert.equal(state.saved.at(-1).data.favorites.length, 1);
      },
      { checkErrors: false },
    ));

  test("후기 탭에서 다른 회원 후기를 보고, 별점을 남기면 review_save 를 부른다", () =>
    runCloud(async (page, state) => {
      await signIn(page);
      await signedIn(page);
      await page.fill("#search", burrito.name);
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.getByRole("tab", { name: "후기" }).click();
      await page.getByText("양이 많고 맛있어요").waitFor();
      await page.locator("label[for='star-4']").click();
      await page.getByLabel(/한줄 후기/).fill("점심에 가기 좋아요");
      await page.getByRole("button", { name: "남기기" }).click();
      await settle(page, 500);
      const call = state.rpc.find((c) => c.name === "review_save");
      assert.deepEqual(call?.body, { p_place: burrito.id, p_rating: 4, p_body: "점심에 가기 좋아요" });
    }));

  test("새 장소 제보는 submission_create 로 보낸다", () =>
    runCloud(async (page, state) => {
      await signIn(page);
      await signedIn(page);
      await page.getByRole("button", { name: "새 장소·꿀팁 제보하기" }).click();
      await page.getByLabel("장소 이름").fill("새로 생긴 분식집");
      await page.getByLabel(/^설명/).fill("학교 앞에 새로 생긴 분식집인데 떡볶이가 맛있어요.");
      await page.getByRole("button", { name: "보내기" }).click();
      await page.getByText("운영자가 확인한 뒤 공개됩니다").first().waitFor();
      const call = state.rpc.find((c) => c.name === "submission_create");
      assert.equal(call?.body.p.name, "새로 생긴 분식집");
      assert.equal(call?.body.p.kind, "new");
      assert.deepEqual(call?.body.p.photos, []);
    }));

  test("관리자 화면에서 대기 중인 제보를 승인한다", () =>
    runCloud(
      async (page, state) => {
        await signIn(page);
        await signedIn(page);
        await page.locator(".headerActions .account").click();
        await page.getByRole("button", { name: "관리자 화면" }).click();
        await page.getByText("대기 중인 제보").waitFor();
        await page.getByRole("button", { name: "승인", exact: true }).click();
        await page.getByText("승인했습니다.").waitFor();
        assert.equal(state.patches[0].body.status, "approved");
        assert.match(state.patches[0].query, new RegExp(`id=eq.${pending.id}`));
      },
      { admin: true },
    ));
});

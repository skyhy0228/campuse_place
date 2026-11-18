// 새 기능 브라우저 테스트 (Supabase 없이): 오늘 뭐 먹지, 가까운 순, 공유받은 목록, 영어 화면, 오래된 정보, 장소 제보 버튼
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { cards, launchBrowser, places, resultCount, settle, startServer, withPage } from "./helpers.mjs";

let server;
let browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const run = (fn, options) => withPage(browser, fn, options);

// src/lib/nearby.ts · campus.ts 와 같은 식 (e2e 는 TypeScript 를 바로 불러오지 않는다)
const SCHOOL = { lat: 36.9688, lng: 127.8728 };
const MX = 111320 * Math.cos((((36.9585 + 36.9765) / 2) * Math.PI) / 180);
const latLngOf = (p) =>
  typeof p.lat === "number" ? { lat: p.lat, lng: p.lng } : p.campusXY ? { lat: 36.9765 - p.campusXY.y / 110540, lng: 127.8635 + p.campusXY.x / MX } : null;
const rad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
// 기준점에서 가장 가까운 곳들 (같은 건물처럼 거리가 같은 곳이 여러 개일 수 있다)
function nearestNames(origin) {
  const withDistance = places.map((p) => ({ p, d: latLngOf(p) ? meters(origin, latLngOf(p)) : Infinity }));
  const min = Math.min(...withDistance.map((x) => x.d));
  return new Set(withDistance.filter((x) => Math.abs(x.d - min) < 0.5).map((x) => x.p.name));
}
const firstCardName = (page) => cards(page).first().locator(".cardLink").innerText();

describe("오늘 뭐 먹지", () => {
  const foodNames = new Set(places.filter((p) => p.category === "식당" || p.category === "카페").map((p) => p.name));
  const cafeNames = new Set(places.filter((p) => p.category === "카페").map((p) => p.name));

  test("바로 가기에서 열면 맛집을 하나 뽑고, 조건을 바꾸거나 다시 뽑을 수 있다", () =>
    run(async (page) => {
      await page.getByRole("navigation", { name: "바로 가기" }).getByRole("button", { name: "오늘 뭐 먹지?" }).click();
      const dialog = page.getByRole("dialog", { name: "오늘 뭐 먹지?" });
      await dialog.waitFor();
      const first = await dialog.locator(".pickCard h3").innerText();
      assert.ok(foodNames.has(first), `${first} 은(는) 맛집·카페가 아닙니다`);

      await dialog.getByRole("group", { name: "종류" }).getByRole("button", { name: "카페", exact: true }).click();
      const cafe = await dialog.locator(".pickCard h3").innerText();
      assert.ok(cafeNames.has(cafe), `${cafe} 은(는) 카페가 아닙니다`);

      await dialog.getByRole("button", { name: "다시 뽑기" }).click();
      const again = await dialog.locator(".pickCard h3").innerText();
      assert.notEqual(again, cafe, "방금 뽑힌 곳이 다시 나왔습니다");

      await dialog.getByRole("button", { name: "자세히 보기" }).click();
      assert.equal(await page.locator("#dialogTitle").innerText(), again);
      assert.match(page.url(), /#place=p[0-9a-f]{8}$/);
    }));

  test("조건에 맞는 곳이 없으면 안내하고 뽑기 버튼을 끈다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: "오늘 뭐 먹지?" }).click();
      const dialog = page.getByRole("dialog", { name: "오늘 뭐 먹지?" });
      // 즐겨찾기가 없으니 후보가 0곳이 된다.
      await dialog.getByRole("button", { name: "즐겨찾기에서만" }).click();
      await dialog.getByText("조건에 맞는 곳이 없어요").waitFor();
      assert.equal(await dialog.getByRole("button", { name: "다시 뽑기" }).isDisabled(), true);
      assert.match(await dialog.locator(".dialogTitleWrap .hint").innerText(), /후보 0곳/);
    }));
});

describe("가까운 순", () => {
  test("기본은 학교 기준이고, 카드에 거리를 보여준다", () =>
    run(async (page) => {
      await page.selectOption("#sort", "near");
      await settle(page);
      await page.getByText("학교(대학로 50)에서 가까운 순입니다.").waitFor();
      assert.ok(nearestNames(SCHOOL).has(await firstCardName(page)));
      const distance = cards(page).first().locator(".meta .distance");
      assert.match(await distance.locator("[aria-hidden]").innerText(), /^\d+(m|\.\dkm)$/);
      assert.match(await distance.locator(".srOnly").innerText(), /^학교에서 \d+(m|\.\dkm)$/);
      // 위치를 모르는 곳은 맨 뒤에 있고 거리가 없다.
      const unknown = places.filter((p) => !latLngOf(p)).length;
      assert.match(await page.locator(".nearBar").innerText(), new RegExp(`위치를 모르는 ${unknown}곳`));
      assert.equal(await cards(page).last().locator(".meta .distance").count(), 0);
      assert.match(page.url(), /sort=near/);
    }));

  test("내 위치를 쓰면 내 위치에서 가까운 곳부터 보여주고, 학교 기준으로 되돌릴 수 있다", async () => {
    const far = places.find((p) => typeof p.lat === "number" && meters(SCHOOL, p) > 5000);
    await run(
      async (page) => {
        await page.selectOption("#sort", "near");
        await page.getByRole("button", { name: "내 위치 기준으로" }).click();
        await page.getByText("내 위치에서 가까운 순입니다.").waitFor();
        await settle(page);
        assert.ok(nearestNames(far).has(await firstCardName(page)), `${far.name} 근처가 맨 앞이 아닙니다`);
        assert.match(await cards(page).first().locator(".meta .distance").getAttribute("title"), /^내 위치에서 /);
        await page.getByRole("button", { name: "학교 기준으로" }).click();
        await settle(page);
        assert.ok(nearestNames(SCHOOL).has(await firstCardName(page)));
      },
      { permissions: ["geolocation"], geolocation: { latitude: far.lat, longitude: far.lng } },
    );
  });
});

describe("공유받은 목록", () => {
  const [a, b] = places.filter((p) => p.recommendations >= 2);
  const url = `?list=shared&ln=${encodeURIComponent("주말 나들이")}&ids=${a.id},${b.id},pdeadbeef`;

  test("링크로 열면 그 목록만 보이고, 없는 장소 수를 알려 준다", () =>
    run(
      async (page) => {
        const banner = page.getByRole("region", { name: /주말 나들이/ });
        await banner.waitFor();
        assert.match(await banner.innerText(), /2곳/);
        assert.match(await banner.innerText(), /1곳은 지금 사이트에 없습니다/);
        assert.equal(await cards(page).count(), 2);
        assert.equal(await resultCount(page), 2);
        // 새로고침해도 유지된다.
        await page.reload();
        await page.waitForSelector("article.card");
        assert.equal(await cards(page).count(), 2);
        // 로그인하지 않았으면 저장 버튼이 로그인으로 안내한다.
        await banner.getByRole("button", { name: "로그인하고 저장하기" }).click();
        await page.locator("dialog[open]").waitFor();
        await page.keyboard.press("Escape");
        await banner.getByRole("button", { name: "공유 목록 닫기" }).click();
        await settle(page);
        assert.equal(await cards(page).count(), places.length);
        assert.doesNotMatch(page.url(), /ids=/);
      },
      { url },
    ));

  test("잘못된 ID 만 있으면 공유 목록을 무시한다", () =>
    run(
      async (page) => {
        assert.equal(await cards(page).count(), places.length);
        assert.equal(await page.locator(".sharedBanner").count(), 0);
      },
      { url: "?list=shared&ids=nope,<x>" },
    ));
});

describe("영어 화면", () => {
  test("English 로 바꾸면 화면 문구와 분류가 영어가 되고, 장소 원문은 한국어로 표시된다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: /^언어/ }).click();
      await page.locator("#langList").getByRole("button", { name: "English" }).click();
      await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
      assert.equal(await page.locator("h1").innerText(), "KNUT Campus Tips");
      assert.equal(await page.title(), "KNUT Campus Tips");
      assert.ok(await page.locator(".chipRow .chip").filter({ hasText: /^Restaurants/ }).count());
      assert.equal(await cards(page).first().locator(".cardTitle").getAttribute("lang"), "ko");

      // 영어 분류 이름으로도 검색된다.
      await page.fill("#search", "Cafés");
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.category === "카페").length);
      await page.fill("#search", "");
      await settle(page);

      await cards(page).first().locator(".cardLink").click();
      await page.getByText("Place names and details are shown in Korean.").waitFor();
      await page.keyboard.press("Escape");

      await page.reload();
      await page.waitForSelector("article.card");
      assert.equal(await page.locator("h1").innerText(), "KNUT Campus Tips");
      assert.equal(await page.locator(".langToggle").getAttribute("aria-label"), "Language: English · EN");
    }));

  test("휴대폰 폭에서 영어 화면도 가로로 넘치지 않는다", () =>
    run(
      async (page) => {
        await page.evaluate(() => localStorage.setItem("campuse:lang", "en"));
        await page.reload();
        await page.waitForSelector("article.card");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `가로로 ${overflow}px 넘칩니다`);
        const head = await page.locator(".sideHead").boundingBox();
        const actions = await page.locator(".headerActions").boundingBox();
        assert.ok(actions.x + actions.width <= head.x + head.width + 1, "머리줄 버튼이 화면 밖으로 나갑니다");
      },
      { viewport: { width: 360, height: 740 } },
    ));
});

describe("오래된 정보", () => {
  const clock = new Date("2026-11-17T03:00:00Z");
  // 2026-11-17 기준 180일이 지난 확인한날
  const stale = places.filter((p) => p.checkedSort && (Date.parse("2026-11-17") - Date.parse(p.checkedSort)) / 86400000 > 180);

  test("확인한 지 오래된 곳에 표시를 붙이고, 상세에서 안내한다", () =>
    run(
      async (page) => {
        assert.ok(stale.length > 0);
        assert.equal(await page.locator("article.card .badge.stale").count(), stale.length);
        await page.fill("#search", stale[0].name);
        await settle(page);
        await cards(page).first().locator(".cardLink").click();
        await page.locator("#dialogTitle").waitFor();
        assert.match(await page.locator(".warnNote").innerText(), new RegExp(`마지막으로 확인한 날\\(${stale[0].checkedSort}\\)`));
      },
      { clock },
    ));
});

describe("장소 제보 바로 가기", () => {
  test("Supabase 가 없으면 바로 가기 버튼이 GitHub 제보 양식을 새 탭으로 연다", () =>
    run(async (page, context) => {
      await context.route(/^https:\/\/github\.com\//, (route) => route.fulfill({ contentType: "text/html", body: "<title>ok</title>" }));
      const quick = page.getByRole("navigation", { name: "바로 가기" });
      const [popup] = await Promise.all([context.waitForEvent("page"), quick.getByRole("button", { name: "장소 제보" }).click()]);
      await popup.waitForURL(/github\.com/);
      assert.match(popup.url(), /github\.com\/skyhy0228\/campuse_place\/issues\/new\?template=new-place\.yml/);
    }));

  test("검색 결과가 없으면 장소 제보를 권한다", () =>
    run(async (page) => {
      await page.fill("#search", "zzzz없는가게");
      await settle(page);
      await page.locator(".notice.empty").getByRole("button", { name: "장소 제보" }).waitFor();
    }));

  test("휴대폰에서도 첫 화면 바로 가기에 있고 가로로 넘치지 않는다", () =>
    run(
      async (page) => {
        assert.equal(await page.getByRole("navigation", { name: "바로 가기" }).getByRole("button", { name: "장소 제보" }).isVisible(), true);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `가로로 ${overflow}px 넘칩니다`);
      },
      { viewport: { width: 360, height: 740 } },
    ));
});

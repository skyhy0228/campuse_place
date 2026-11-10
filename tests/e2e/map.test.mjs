// 지도 보기 테스트. 네이버 지도 스크립트는 helpers 의 가짜 스크립트로 바뀌어 핀이 .fakeMarker 버튼으로 그려진다.
// 지도 키를 넣어 빌드해야 지도 버튼이 보이므로 npm run build:e2e 로 빌드한 dist 에서 실행한다.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { FAKE_NAVER_MAPS, NAVER_MAPS_URL, cards, chip, launchBrowser, places, settle, startServer, withPage } from "./helpers.mjs";

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

const isLocated = (p) => typeof p.lat === "number" && typeof p.lng === "number";
const located = places.filter(isLocated);
const unlocated = places.filter((p) => !isLocated(p));
// 앱과 같은 규칙(소수 6자리)으로 같은 좌표의 장소를 묶는다.
function groupsOf(list) {
  const groups = new Map();
  for (const p of list.filter(isLocated)) {
    const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()];
}

const markers = (page) => page.locator(".mapCanvas .fakeMarker");

// PC 화면의 사이드바 메뉴(홈/지도/캠퍼스). 지도 키가 없으면 '지도'가 없다.
const nav = (page) => page.getByRole("navigation", { name: "화면 이동" }).first();
const hasMap = async (page) => (await nav(page).getByRole("button", { name: "지도", exact: true }).count()) > 0;

async function openMap(page, t) {
  if (!(await hasMap(page))) {
    t.skip("지도 키 없이 빌드된 dist 입니다. npm run build:e2e 로 빌드하세요.");
    return false;
  }
  await nav(page).getByRole("button", { name: "지도", exact: true }).click();
  await page.waitForSelector(".mapCanvas .fakeMap");
  return true;
}

describe("지도 보기", () => {
  test("데이터: 핀으로 쓸 좌표가 있고, 학교 대표 주소 좌표는 쓰지 않는다", () => {
    assert.ok(located.length > 100);
    const campus = located.filter((p) => Math.abs(p.lat - 36.9688337) < 1e-6 && Math.abs(p.lng - 127.8728071) < 1e-6);
    assert.equal(campus.length, 0);
  });

  test("지도로 바꾸면 위치가 특정된 장소마다 핀이 꽂히고, 보기 방식이 주소에 남는다", (t) =>
    run(async (page) => {
      if (!(await openMap(page, t))) return;
      assert.equal(await markers(page).count(), groupsOf(places).length);
      assert.match(await page.locator(".mapNote").innerText(), new RegExp(`${located.length}곳만 핀으로`));
      assert.equal(await cards(page).count(), 0);
      assert.equal(await page.locator(".popular").count(), 0);

      await settle(page);
      assert.match(page.url(), /[?&]view=map/);
      await page.reload();
      await page.waitForSelector(".mapCanvas .fakeMarker");
      assert.equal(await markers(page).count(), groupsOf(places).length);

      await nav(page).getByRole("button", { name: "홈", exact: true }).click();
      await page.waitForSelector("article.card");
      await settle(page);
      assert.doesNotMatch(page.url(), /view=map/);
    }));

  test("같은 위치의 장소는 핀 하나로 묶이고, 고른 장소의 상세에 작은 지도가 나온다", (t) =>
    run(async (page) => {
      if (!(await openMap(page, t))) return;
      const biggest = groupsOf(places).sort((a, b) => b.length - a.length)[0];
      assert.ok(biggest.length > 1);
      await page.locator(`.fakeMarker[aria-label$="외 ${biggest.length - 1}곳"]`).first().click();

      const panel = page.getByRole("region", { name: "선택한 위치의 장소" });
      await panel.waitFor();
      assert.match(await panel.locator(".pinPanelHead").innerText(), new RegExp(`${biggest.length}곳`));
      assert.equal(await panel.locator(".pinList li").count(), biggest.length);

      const name = await panel.locator(".pinName").first().innerText();
      await panel.locator(".pinItem").first().click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor();
      assert.equal(await dialog.locator("h2").innerText(), name);
      assert.match(page.url(), /#place=p[0-9a-f]{8}$/);
      await dialog.getByRole("tab", { name: "정보" }).click();
      await dialog.locator(".miniMap .fakeMarker").waitFor();
      assert.equal(await dialog.locator(".miniMap .fakeMarker").count(), 1);

      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      // 지도를 누르면 묶음 안내가 닫힌다.
      await page.locator(".fakeMap").click({ position: { x: 600, y: 300 } });
      assert.equal(await panel.count(), 0);
    }));

  test("분류 필터를 바꾸면 핀도 그 분류만 남는다", (t) =>
    run(async (page) => {
      if (!(await openMap(page, t))) return;
      await chip(page, "맛집").click();
      await settle(page);
      assert.equal(await markers(page).count(), groupsOf(places.filter((p) => p.category === "식당")).length);
    }));

  test("표시할 핀이 없으면 안내하고 목록으로 돌아갈 수 있다", (t) =>
    run(async (page) => {
      // 좌표가 없는 장소 하나만 즐겨찾기한 상태로 즐겨찾기 목록을 지도로 본다.
      await page.evaluate((id) => localStorage.setItem("campuse-place:favorites:v1", JSON.stringify([id])), unlocated[0].id);
      await page.reload();
      await page.waitForSelector("article.card");
      await page.getByRole("button", { name: /^즐겨찾기 1/ }).click();
      if (!(await openMap(page, t))) return;
      await page.getByText("지도에 표시할 수 있는 곳이 없습니다").waitFor();
      await page.getByRole("button", { name: "목록으로 보기" }).click();
      await page.waitForSelector("article.card");
      assert.equal(await cards(page).count(), 1);
    }));

  test("상세 보기: 좌표가 있는 장소만 작은 지도를 보여준다", (t) =>
    run(
      async (page) => {
        if (!(await hasMap(page))) return t.skip("지도 키 없이 빌드된 dist 입니다.");
        await page.getByRole("tab", { name: "정보" }).click();
        await page.locator("dialog[open] .miniMap .fakeMarker").waitFor();
        await page.evaluate((id) => (location.hash = `#place=${id}`), unlocated[0].id);
        await page.locator("dialog[open] h2", { hasText: unlocated[0].name }).waitFor();
        await page.getByRole("tab", { name: "정보" }).click();
        assert.equal(await page.locator("dialog[open] .miniMap").count(), 0);
      },
      { url: `#place=${located[0].id}` },
    ));

  test("지도 인증에 실패하면 원인을 안내한다", (t) =>
    run(async (page) => {
      await page.route(NAVER_MAPS_URL, (route) =>
        route.fulfill({ contentType: "text/javascript", body: `${FAKE_NAVER_MAPS}\nsetTimeout(() => window.navermap_authFailure?.(), 0);` }),
      );
      if (!(await openMap(page, t))) return;
      const alert = page.locator(".mapOverlay.error");
      await alert.waitFor();
      assert.match(await alert.innerText(), /인증에 실패/);
    }));
});

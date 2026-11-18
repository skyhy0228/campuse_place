// 검색 중심 첫 화면(yufe9) 브라우저 테스트: 소주제 사전을 켠 채(topics: true) 연다.
// 첫 화면 안에 함께 놓은 기능(바로 가기, 결과 없음의 장소 제보, 결과 줄의 오래된 정보, 영어 화면)도 여기서 확인한다.
// 카드 목록·필터·정렬은 다른 파일에서 사전을 막은 예전 첫 화면으로 검사한다 (helpers.mjs 의 blockTopics 설명 참고).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { axeScan, cards, launchBrowser, places, settle, startServer, withPage } from "./helpers.mjs";

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

// 회전하는 추천 주제가 검사 도중 바뀌지 않게 '동작 줄이기'로 연다.
const run = (fn, options = {}) => withPage(browser, fn, { topics: true, reducedMotion: "reduce", ...options });
const isFood = (p) => p.category === "식당" || p.category === "카페";
const entries = (page) => page.getByRole("navigation", { name: "둘러보기" });
const quick = (page) => page.locator(".searchHero").getByRole("navigation", { name: "바로 가기" });

describe("검색 중심 첫 화면", () => {
  test("검색창·추천 주제·입구 3개·바로 가기를 보여 주고, 옆 패널의 검색·필터와 카드 목록은 숨긴다", () =>
    run(async (page) => {
      assert.equal(await page.locator(".heroTitle").innerText(), "무엇을 찾고 있나요?");
      assert.equal(await page.locator(".app").getAttribute("data-home"), "search");
      const chips = await page.locator(".heroChips .topicChip").count();
      assert.ok(chips >= 1 && chips <= 4, `추천 주제 ${chips}개`);
      assert.deepEqual(await entries(page).getByRole("button").allInnerTexts(), ["맛집", "장소", "정보"]);
      // Supabase 가 없으면 학식·버스는 보이지 않는다.
      assert.deepEqual(await quick(page).getByRole("button").allInnerTexts(), ["오늘 뭐 먹지?", "장소 제보"]);
      assert.equal(await cards(page).count(), 0);
      assert.equal(await page.locator("#search").isVisible(), false);
      assert.equal(await page.locator(".controls").isVisible(), false);
    }));

  test("검색하면 결과가 나오고, 줄을 누르면 상세가 열린다", () =>
    run(async (page) => {
      await page.fill("#heroSearch", "택시");
      await page.locator(".results .resultRow").first().waitFor();
      assert.match(await page.locator(".results .resultCount").innerText(), /^\d+개 찾음$/);
      const title = await page.locator(".results .resultRow .rowTitle").first().innerText();
      await page.locator(".results .resultRow").first().click();
      await page.waitForSelector("dialog[open]");
      assert.equal(await page.locator("#dialogTitle").innerText(), title);
      await page.keyboard.press("Escape");
      await settle(page);
      assert.equal(await page.inputValue("#heroSearch"), "택시");
    }));

  test("추천 주제를 누르면 그 주제로 검색한다", () =>
    run(async (page) => {
      const chip = page.locator(".heroChips .topicChip").first();
      const label = (await chip.innerText()).replace(/^\S+\s*/u, "").trim();
      await chip.click();
      await settle(page);
      assert.ok((await page.inputValue("#heroSearch")).includes(label), `검색창: ${await page.inputValue("#heroSearch")}, 칩: ${label}`);
      assert.ok((await page.locator(".results, .searchEmpty").count()) > 0);
    }));

  test("결과가 없으면 추천 검색어와 장소 제보를 보여 주고, 제보는 GitHub 양식을 연다", () =>
    run(async (page, context) => {
      await context.route(/^https:\/\/github\.com\//, (route) => route.fulfill({ contentType: "text/html", body: "<title>ok</title>" }));
      await page.fill("#heroSearch", "zzzz없는가게");
      const empty = page.locator(".searchEmpty");
      await empty.waitFor();
      assert.ok((await empty.locator(".topicChip").count()) > 0);
      const [popup] = await Promise.all([context.waitForEvent("page"), empty.getByRole("button", { name: "장소 제보" }).click()]);
      await popup.waitForURL(/github\.com/);
      assert.match(popup.url(), /issues\/new\?template=new-place\.yml/);
    }));

  test("바로 가기의 '오늘 뭐 먹지?'는 첫 화면에서 맛집을 하나 뽑는다", () =>
    run(async (page) => {
      const foodNames = new Set(places.filter(isFood).map((p) => p.name));
      await quick(page).getByRole("button", { name: "오늘 뭐 먹지?" }).click();
      const dialog = page.getByRole("dialog", { name: "오늘 뭐 먹지?" });
      await dialog.waitFor();
      assert.ok(foodNames.has(await dialog.locator(".pickCard h3").innerText()));
    }));
});

describe("입구", () => {
  test("맛집은 맛집·카페 카드 목록이고, '처음으로'로 돌아온다", () =>
    run(async (page) => {
      await entries(page).getByRole("button", { name: "맛집" }).click();
      await page.waitForSelector("article.card");
      assert.equal(await cards(page).count(), places.filter(isFood).length);
      // 주소는 잠깐 뒤에 바뀐다 (App 의 300ms 지연).
      await page.waitForURL(/go=food/);
      await page.getByRole("button", { name: "처음으로" }).click();
      await page.waitForSelector(".searchHero .entries");
      assert.equal(await cards(page).count(), 0);
    }));

  test("장소·정보는 소주제별 목록이고, 확인한 지 오래된 곳에는 표시가 붙는다", async () => {
    const clock = new Date("2026-11-17T03:00:00Z");
    const staleNames = new Set(
      places.filter((p) => p.checkedSort && (Date.parse("2026-11-17") - Date.parse(p.checkedSort)) / 86400000 > 180).map((p) => p.name),
    );
    await run(
      async (page) => {
        let marked = 0;
        for (const name of ["장소", "정보"]) {
          await entries(page).getByRole("button", { name }).click();
          await page.waitForSelector(".browse .resultRow");
          assert.equal(await page.locator(".browse .listTitle").innerText(), name);
          assert.ok((await page.locator(".browse .browseGroupTitle").count()) > 0);
          const staleTitles = await page.$$eval(".browse .resultRow", (rows) =>
            rows.filter((r) => r.querySelector(".rowStale")).map((r) => r.querySelector(".rowTitle").textContent),
          );
          for (const title of staleTitles) assert.ok(staleNames.has(title), `${title} 은(는) 오래된 정보가 아닙니다`);
          marked += staleTitles.length;
          await page.getByRole("button", { name: "처음으로" }).click();
          await page.waitForSelector(".searchHero .entries");
        }
        assert.ok(marked > 0, "오래된 정보 표시가 하나도 없습니다");
      },
      { clock },
    );
  });
});

describe("첫 화면과 다른 화면 사이", () => {
  test("가까운 순 주소로 열면 거리가 붙은 카드 목록을 보여 준다", () =>
    run(
      async (page) => {
        await page.getByText("학교(대학로 50)에서 가까운 순입니다.").waitFor();
        assert.ok((await cards(page).first().locator(".meta .distance").count()) === 1);
        assert.equal(await page.locator(".app").getAttribute("data-home"), null);
      },
      { url: "?sort=near", ready: "article.card" },
    ));

  test("'홈'은 분류를 고른 화면에서도 검색 첫 화면으로 돌아간다", () =>
    run(
      async (page) => {
        await page.locator("nav.sideNav").getByRole("button", { name: "홈" }).click();
        await page.waitForSelector(".searchHero .entries");
        await page.waitForTimeout(600);
        assert.equal(new URL(page.url()).search, "");
      },
      { url: "?cat=카페", ready: "article.card" },
    ));
});

describe("언어와 화면 크기", () => {
  test("영어 화면에서는 첫 화면 문구가 영어이고, 예시 검색어는 찾아지는 한국어로 보여 준다", () =>
    run(async (page) => {
      await page.evaluate(() => localStorage.setItem("campuse:lang", "en"));
      await page.reload();
      await page.waitForSelector(".searchHero .entries");
      assert.equal(await page.locator(".heroTitle").innerText(), "What are you looking for?");
      assert.deepEqual(await page.getByRole("navigation", { name: "Browse" }).getByRole("button").allInnerTexts(), ["Food", "Places", "Info"]);
      assert.match(await page.getAttribute("#heroSearch", "placeholder"), /^e\.g\. .*[가-힣]/);
      assert.ok((await page.locator(".searchHero").getByRole("navigation", { name: "Shortcuts" }).count()) === 1);
    }));

  test("휴대폰: 가로로 넘치지 않고, 입구·바로 가기는 누르기 충분한 크기다", () =>
    run(
      async (page) => {
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
        const boxes = await page.$$eval(".searchHero .entry, .searchHero .quickItem", (els) => els.map((e) => e.getBoundingClientRect()).map((b) => [b.width, b.height]));
        assert.ok(boxes.length >= 5);
        for (const [w, h] of boxes) assert.ok(w >= 44 && h >= 44, `${w}x${h}`);
      },
      { viewport: { width: 360, height: 740 } },
    ));
});

describe("접근성 (axe)", () => {
  for (const colorScheme of ["light", "dark"]) {
    test(`${colorScheme === "dark" ? "어두운" : "밝은"} 화면: 첫 화면, 검색 결과, 결과 없음, 둘러보기`, () =>
      run(
        async (page) => {
          await axeScan(page, "검색 첫 화면");
          await page.fill("#heroSearch", "택시");
          await page.locator(".results .resultRow").first().waitFor();
          await axeScan(page, "검색 결과");
          await page.fill("#heroSearch", "zzzz없는가게");
          await page.locator(".searchEmpty").waitFor();
          await axeScan(page, "결과 없음");
          await page.fill("#heroSearch", "");
          await entries(page).getByRole("button", { name: "장소" }).click();
          await page.waitForSelector(".browse .resultRow");
          await axeScan(page, "둘러보기(장소)");
        },
        { colorScheme, clock: new Date("2026-11-17T03:00:00Z") },
      ));
  }
});

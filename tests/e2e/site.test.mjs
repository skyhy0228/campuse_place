import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { BASE, cards, chip, launchBrowser, places, resultCount, settle, startServer, withPage } from "./helpers.mjs";

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
const KST_OFFSET = 9 * 60;

describe("목록과 데이터", () => {
  test("모든 항목이 카드로 표시되고 빈 값 문자열이 화면에 나오지 않는다", () =>
    run(async (page) => {
      assert.equal(await cards(page).count(), places.length);
      assert.equal(await resultCount(page), places.length);
      assert.equal(await page.locator("h1").textContent(), "교통대 꿀팁 모음");
      assert.equal(await page.title(), "교통대 꿀팁 모음");
      const body = await page.locator("body").innerText();
      assert.ok(!/\b(undefined|null|NaN)\b|정보 없음/.test(body));
    }));

  test("정리된 이름이 적용되고 폴더명 접두어가 보이지 않는다", () =>
    run(async (page) => {
      const titles = await page.$$eval("article.card .cardTitle", (els) => els.map((e) => e.textContent));
      assert.ok(titles.every((t) => !/^\d+_/.test(t)));
      assert.ok(titles.includes("동아리 신청"));
    }));

  test("자동 생성된 한줄설명은 카드에 나오지 않는다", () =>
    run(async (page) => {
      const summaries = await page.$$eval("article.card .cardSummary", (els) => els.map((e) => e.textContent));
      assert.ok(summaries.every((s) => !/에 관한 (생활|참고) 정보|이용에 참고할 수 있는 장소 정보|^식사 메뉴를 제공하는/.test(s)));
    }));

  test("'추천 많은 곳'은 기본 화면에만 나온다", () =>
    run(async (page) => {
      const items = await page.locator(".popularList li").count();
      assert.ok(items > 0 && items <= 8);
      await chip(page, "맛집").click();
      await settle(page);
      assert.equal(await page.locator(".popular").count(), 0);
    }));
});

describe("검색", () => {
  test("이름·메뉴 검색과 공백 AND 검색, 결과 없음, 초기화", () =>
    run(async (page) => {
      await page.fill("#search", "초밥");
      await settle(page);
      const n = await cards(page).count();
      assert.ok(n > 0 && n < places.length);
      assert.equal(await resultCount(page), n);

      await page.fill("#search", "쇼쿠 호암");
      await settle(page);
      assert.ok((await cards(page).first().innerText()).includes("쇼쿠스시"));

      await page.fill("#search", "zzzz없는검색어");
      await settle(page);
      assert.equal(await page.locator(".notice.empty").count(), 1);
      await page.getByRole("button", { name: "필터 초기화" }).click();
      await settle(page);
      assert.equal(await cards(page).count(), places.length);
      assert.equal(await page.inputValue("#search"), "");
    }));

  test("초성 검색", () =>
    run(async (page) => {
      await page.fill("#search", "ㅅㅋㅅㅅ");
      await settle(page);
      const titles = await page.$$eval("article.card .cardTitle", (els) => els.map((e) => e.textContent));
      assert.ok(titles.includes("쇼쿠스시 충주호암점"), titles.join(","));
      assert.ok(titles.length < 20);
    }));

  test("한글 입력 중에도 즉시 반영된다", () =>
    run(async (page) => {
      await page.focus("#search");
      await page.keyboard.insertText("김치");
      await settle(page);
      const n = await cards(page).count();
      assert.ok(n > 0 && n < places.length);
    }));
});

describe("분류·필터·정렬", () => {
  test("분류 필터", () =>
    run(async (page) => {
      await chip(page, "맛집").click();
      await settle(page);
      const expected = places.filter((p) => p.category === "식당").length;
      assert.equal(await cards(page).count(), expected);
      const badges = await page.locator("article.card .badges .badge:first-child").allInnerTexts();
      assert.ok(badges.every((b) => b === "맛집"));
    }));

  test("교내/교외 필터는 데이터의 분류와 일치한다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: /^필터/ }).click();
      await page.getByRole("group", { name: "추가 필터" }).getByRole("button", { name: "교내", exact: true }).click();
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.campus === "in").length);
      await page.getByRole("group", { name: "추가 필터" }).getByRole("button", { name: "교외", exact: true }).click();
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.campus === "out").length);
    }));

  test("가격 필터는 데이터의 구간과 일치한다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: /^필터/ }).click();
      await page.selectOption("#price", "under10");
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.priceBand === "under10").length);
      await page.selectOption("#price", "free");
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.priceBand === "free").length);
    }));

  test("정렬: 추천수·이름·확인한날(날짜 없는 항목은 뒤)", () =>
    run(async (page) => {
      const recs = () => page.$$eval("article.card .recommend", (els) => els.map((e) => Number(e.textContent.replace(/[^0-9]/g, ""))));
      const r = await recs();
      assert.ok(r.every((v, i) => i === 0 || r[i - 1] >= v));

      await page.selectOption("#sort", "name");
      await settle(page);
      const names = await page.$$eval("article.card .cardTitle", (els) => els.map((e) => e.textContent));
      assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "ko")));

      await page.selectOption("#sort", "checked");
      await settle(page);
      const dates = await page.$$eval("article.card", (els) => els.map((e) => (e.querySelector(".checked")?.textContent ?? "").replace("확인 ", "")));
      const keyOf = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : null);
      const keys = dates.map(keyOf);
      let seenNull = false;
      keys.forEach((k, i) => {
        if (k === null) seenNull = true;
        else {
          assert.ok(!seenNull, "날짜 없는 항목이 날짜 있는 항목보다 앞에 있습니다");
          if (i > 0 && keys[i - 1] !== null) assert.ok(keys[i - 1] >= k);
        }
      });
      assert.ok(keys[0] !== null && keys.at(-1) === null);
    }));
});

// 운영시간: 데이터에 해석된 일정이 있을 때, 시각을 고정해 '영업 중' 판단을 독립적으로 검증한다.
describe("지금 영업 중", () => {
  const isOpen = (place, day, minutes) => {
    const today = place.schedule?.[day];
    if (!today) return false;
    const [open, close, bs, be] = today;
    if (minutes < open || minutes >= close) return false;
    return !(bs !== undefined && minutes >= bs && minutes < be);
  };

  for (const [label, kst] of [
    ["수요일 낮 12:30", "2026-10-21T12:30:00+09:00"],
    ["일요일 밤 23:30", "2026-10-25T23:30:00+09:00"],
    ["월요일 새벽 03:00", "2026-10-19T03:00:00+09:00"],
  ]) {
    test(`${label}에 영업 중인 곳만 보여준다`, async () => {
      const date = new Date(kst);
      const shifted = new Date(date.getTime() + KST_OFFSET * 60_000);
      const day = shifted.getUTCDay();
      const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
      const expected = places.filter((p) => isOpen(p, day, minutes)).map((p) => p.name).sort();
      await run(async (page) => {
        await page.getByRole("button", { name: /^필터/ }).click();
        await page.getByRole("button", { name: "지금 영업 중" }).click();
        await settle(page);
        const shown = (await page.$$eval("article.card .cardTitle", (els) => els.map((e) => e.textContent))).sort();
        assert.deepEqual(shown, expected);
        if (expected.length) assert.ok((await page.locator("article.card .badge.open").count()) === expected.length);
      }, { timezoneId: "America/Los_Angeles", clock: date });
    });
  }
});

describe("주소로 상태 공유", () => {
  test("검색·필터가 주소에 담기고 새로고침해도 복원된다", () =>
    run(async (page) => {
      await chip(page, "카페").click();
      await page.selectOption("#sort", "name");
      await page.fill("#search", "커피");
      await page.waitForTimeout(600);
      const params = new URL(page.url()).searchParams;
      assert.equal(params.get("cat"), "카페");
      assert.equal(params.get("sort"), "name");
      assert.equal(params.get("q"), "커피");
      const before = await resultCount(page);

      await page.reload();
      await page.waitForSelector("article.card");
      assert.equal(await page.inputValue("#search"), "커피");
      assert.equal(await page.locator("#sort").inputValue(), "name");
      assert.equal(await chip(page, "카페").getAttribute("aria-pressed"), "true");
      assert.equal(await resultCount(page), before);
    }));

  test("초기화하면 주소의 필터도 지워진다", () =>
    run(async (page) => {
      await page.fill("#search", "커피");
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: "초기화", exact: true }).click();
      await page.waitForTimeout(600);
      assert.equal(new URL(page.url()).search, "");
    }));
});

describe("즐겨찾기(로그인 전)", () => {
  test("저장하고 새로고침 후 복원한다", () =>
    run(async (page) => {
      await page.fill("#search", "쇼쿠스시");
      await settle(page);
      const star = cards(page).first().locator("button[aria-pressed]");
      await star.click();
      assert.equal(await star.getAttribute("aria-pressed"), "true");
      assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("campuse-place:favorites:v1"))).length, 1);
      await page.reload();
      await page.waitForSelector("article.card");
      await page.getByRole("button", { name: /^즐겨찾기 1$/ }).click();
      await settle(page);
      assert.equal(await cards(page).count(), 1);
    }));
});

describe("상세 보기", () => {
  test("열고 닫기, 해시, 포커스 복원, 지도·제보 링크", () =>
    run(async (page) => {
      await page.fill("#search", "밍거스");
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.waitForSelector("dialog[open]");
      assert.match(page.url(), /#place=p[0-9a-f]{8}$/);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "상세 닫기");

      const map = page.locator("dialog a.button.primary");
      assert.match(await map.getAttribute("href"), /^https:\/\/(naver\.me|map\.naver\.com)\//);
      assert.equal(await map.getAttribute("target"), "_blank");
      assert.match(await map.getAttribute("rel"), /noopener/);

      const report = page.getByRole("link", { name: "정보가 달라요" });
      const href = new URL(await report.getAttribute("href"));
      assert.equal(href.origin + href.pathname, "https://github.com/skyhy0228/campuse_place/issues/new");
      assert.equal(href.searchParams.get("template"), "report.yml");
      assert.equal(href.searchParams.get("place"), "밍거스 바베큐");
      assert.match(href.searchParams.get("place_id"), /^p[0-9a-f]{8}$/);
      assert.match(await report.getAttribute("rel"), /noopener/);

      assert.match(await page.title(), /^밍거스 바베큐 · /);
      await page.keyboard.press("Escape");
      await settle(page);
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.ok(!page.url().includes("#place="));
      assert.equal(await page.title(), "교통대 꿀팁 모음");
      assert.ok(await page.evaluate(() => !!document.activeElement?.closest("article.card")));
    }));

  test("해시 주소로 접속하면 상세가 바로 열린다", async () => {
    const target = places.find((p) => p.name === "밍거스 바베큐");
    await run(async (page) => {
      await page.waitForSelector("dialog[open]");
      assert.equal(await page.locator("dialog h2").textContent(), "밍거스 바베큐");
    }, { url: `#place=${target.id}` });
  });

  test("위치의 부가 설명은 주소와 분리되어 표시된다", async () => {
    const target = places.find((p) => p.locationNotes.length > 0 && !p.name.includes(" · "));
    await run(async (page) => {
      await page.locator("article.card").getByRole("button", { name: target.name, exact: true }).click();
      await page.waitForSelector("dialog[open]");
      assert.equal(await page.locator("dialog .rowNote").count(), target.locationNotes.length);
    });
  });

  test("링크 복사(또는 공유)", () =>
    run(async (page) => {
      await cards(page).first().locator(".cardLink").click();
      await page.waitForSelector("dialog[open]");
      await page.getByRole("button", { name: /링크 복사|공유/ }).click();
      await settle(page);
      const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      assert.ok(/#place=p[0-9a-f]{8}$/.test(clip) || (await page.evaluate(() => typeof navigator.share === "function")));
    }));
});

describe("사진", () => {
  test("별칭으로 연결한 사진이 상세에서 로드된다", async () => {
    const target = places.find((p) => p.name === "쇼쿠스시 충주호암점");
    assert.ok(target.images.length === 2, "쇼쿠스시 충주호암점의 사진 연결이 필요합니다");
    await run(async (page) => {
      await page.fill("#search", "쇼쿠스시");
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.waitForSelector("dialog[open]");
      await page.waitForTimeout(500);
      const loaded = await page.locator("dialog img.galleryImage").evaluateAll((els) => els.map((e) => e.naturalWidth > 0));
      assert.deepEqual(loaded, [true, true]);
    });
  });
});

describe("오류 상태", () => {
  test("데이터를 불러오지 못하면 안내하고, 다시 시도하면 복구된다", async () => {
    const context = await browser.newContext({ serviceWorkers: "block", locale: "ko-KR" });
    const page = await context.newPage();
    let fail = true;
    await page.route("**/data/places.json", (route) => (fail ? route.abort() : route.continue()));
    await page.goto(BASE);
    await page.waitForSelector(".notice.error");
    assert.ok((await page.locator(".notice.error").innerText()).includes("불러오지 못했습니다"));
    fail = false;
    await page.getByRole("button", { name: "다시 시도" }).click();
    await page.waitForSelector("article.card");
    assert.equal(await cards(page).count(), places.length);
    await context.close();
  });

  test("이미지 요청이 실패하면 카드는 이미지 없이, 상세는 대체 표시로 보인다", async () => {
    const context = await browser.newContext({ serviceWorkers: "block", locale: "ko-KR" });
    const page = await context.newPage();
    await page.route("**/images/places/*.webp", (route) => route.abort());
    await page.goto(BASE);
    await page.waitForSelector("article.card");
    await page.fill("#search", "밍거스");
    await settle(page, 600);
    assert.equal(await page.locator("article.card img").count(), 0);
    await cards(page).first().locator(".cardLink").click();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(600);
    assert.equal(await page.locator("dialog .imageFallback").count(), 2);
    await context.close();
  });
});

describe("화면 테마", () => {
  test("자동 → 밝게 → 어둡게로 바뀌고 새로고침 후에도 유지된다", () =>
    run(async (page) => {
      const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const toggle = page.getByRole("button", { name: /^화면 테마/ });
      const auto = await bg();
      await toggle.click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
      await toggle.click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      const dark = await bg();
      assert.notEqual(dark, auto);
      await page.reload();
      await page.waitForSelector("article.card");
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      assert.equal(await bg(), dark);
    }));

  test("기기의 어두운 화면 설정을 따른다", () =>
    run(async (page) => {
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(bg, "rgb(23, 25, 28)");
    }, { colorScheme: "dark" }));
});

describe("반응형", () => {
  for (const [label, viewport] of [
    ["모바일", { width: 390, height: 844 }],
    ["태블릿", { width: 768, height: 1024 }],
  ]) {
    test(`${label}: 가로 넘침 없음, 터치 대상 크기, 상세가 화면 안에 들어온다`, () =>
      run(async (page) => {
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
        const box = await page.locator("#search").boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 0.5);
        const small = await page.$$eval("article.card button:not(.cardLink), article.card a", (els) =>
          els.filter((e) => {
            const b = e.getBoundingClientRect();
            return b.width > 0 && (b.width < 36 || b.height < 36);
          }).length,
        );
        assert.equal(small, 0);
        await page.fill("#search", "밍거스");
        await settle(page);
        await cards(page).first().locator(".cardLink").click();
        await page.waitForSelector("dialog[open]");
        await settle(page, 500);
        const dialog = await page.locator("dialog").boundingBox();
        assert.ok(dialog.x >= -0.5 && dialog.x + dialog.width <= viewport.width + 0.5 && dialog.y >= -0.5 && dialog.y + dialog.height <= viewport.height + 0.5);
        assert.ok((await page.evaluate(() => document.querySelector("dialog").scrollWidth - document.querySelector("dialog").clientWidth)) <= 0);
      }, { viewport }));
  }

  test("모바일: 분류 칩은 한 줄로 옆으로 넘겨 볼 수 있다", () =>
    run(async (page) => {
      const row = page.locator(".chipRow");
      const info = await row.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height }));
      assert.ok(info.scroll > info.client, "칩이 한 줄 안에서 넘쳐야 합니다");
      assert.ok(info.height < 60, `칩 줄이 여러 줄로 쌓였습니다 (${info.height}px)`);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    }, { viewport: { width: 390, height: 844 } }));
});

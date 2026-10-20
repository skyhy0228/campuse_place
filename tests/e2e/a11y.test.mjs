import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import { BASE, cards, chip, launchBrowser, places, settle, startServer, withPage } from "./helpers.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

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

// WCAG 2.1 A/AA 규칙(색 대비 포함)과 모범 사례 규칙으로 현재 화면을 검사한다.
async function scan(page, label) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1, 2).join("")}`),
    }));
  });
  assert.deepEqual(violations, [], `${label}: 접근성 위반 ${violations.length}건\n${JSON.stringify(violations, null, 2)}`);
}

const openFirstDetail = async (page) => {
  await page.locator("article.card").getByRole("button", { name: "밍거스 바베큐", exact: true }).click();
  await page.waitForSelector("dialog[open]");
  await settle(page, 300);
};

describe("접근성(axe-core)", () => {
  for (const scheme of ["light", "dark"]) {
    describe(scheme === "light" ? "밝은 화면" : "어두운 화면", () => {
      const options = { colorScheme: scheme };

      test("목록", () => run((page) => scan(page, `목록 ${scheme}`), options));

      test("필터 패널을 연 목록", () =>
        run(async (page) => {
          await page.getByRole("button", { name: /^필터/ }).click();
          await page.getByRole("button", { name: "지금 영업 중" }).click();
          await settle(page);
          await scan(page, `필터 ${scheme}`);
        }, options));

      test("결과 없음 화면", () =>
        run(async (page) => {
          await page.fill("#search", "zzzz없는검색어");
          await settle(page);
          await scan(page, `빈 결과 ${scheme}`);
        }, options));

      test("상세 보기", () =>
        run(async (page) => {
          await openFirstDetail(page);
          await scan(page, `상세 ${scheme}`);
        }, options));

      test("로그인·회원가입·비밀번호 찾기 화면", () =>
        run(async (page) => {
          await page.locator(".headerActions .account").click();
          await scan(page, `로그인 ${scheme}`);
          await page.getByRole("group", { name: "계정 메뉴" }).getByRole("button", { name: "회원가입", exact: true }).click();
          await scan(page, `회원가입 ${scheme}`);
          await page.getByRole("group", { name: "계정 메뉴" }).getByRole("button", { name: "비밀번호 찾기", exact: true }).click();
          await scan(page, `비밀번호 찾기 ${scheme}`);
        }, options));

      test("내 계정 화면", () =>
        run(async (page) => {
          await page.locator(".headerActions .account").click();
          await page.getByRole("group", { name: "계정 메뉴" }).getByRole("button", { name: "회원가입", exact: true }).click();
          await page.getByLabel("아이디", { exact: true }).fill("tester01");
          await page.getByLabel("비밀번호", { exact: true }).fill("Passw0rd9");
          await page.getByLabel("비밀번호 확인", { exact: true }).fill("Passw0rd9");
          await page.getByLabel("질문의 답").fill("파랑이");
          await page.getByRole("dialog").getByRole("button", { name: "회원가입", exact: true }).last().click();
          await page.waitForSelector("dialog[open]", { state: "detached" });
          await openFirstDetail(page);
          await page.getByRole("button", { name: "내 목록에 담기" }).click();
          await scan(page, `목록 담기 ${scheme}`);
          await page.keyboard.press("Escape");
          await settle(page);
          await page.locator(".headerActions .account").click();
          await scan(page, `내 계정 ${scheme}`);
        }, options));
    });
  }

  test("모바일 목록과 상세", () =>
    run(async (page) => {
      await scan(page, "모바일 목록");
      await openFirstDetail(page);
      await scan(page, "모바일 상세");
    }, { viewport: { width: 390, height: 844 } }));
});

describe("키보드와 보조 기술", () => {
  test("본문 바로가기 링크가 첫 번째로 포커스되고 본문으로 이동한다", () =>
    run(async (page) => {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      assert.equal(focused, "본문 바로가기");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
    }));

  test("모든 입력창과 버튼에 접근 가능한 이름이 있다", () =>
    run(async (page) => {
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll("button, a[href], input, select")]
          .filter((el) => {
            const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim() || (el.labels?.[0]?.textContent ?? "").trim();
            return !name && el.type !== "hidden";
          })
          .map((el) => el.outerHTML.slice(0, 80)),
      );
      assert.deepEqual(unnamed, []);
    }));

  test("상세 화면이 열려 있는 동안 포커스가 화면 밖으로 나가지 않는다", () =>
    run(async (page) => {
      await openFirstDetail(page);
      for (let i = 0; i < 15; i += 1) {
        await page.keyboard.press("Tab");
        // 마지막 요소 다음 Tab 은 브라우저 주소창으로 나갈 수 있다(activeElement 가 body). 배경 페이지의 요소로 가면 안 된다.
        const ok = await page.evaluate(() => {
          const el = document.activeElement;
          return !el || el === document.body || !!el.closest("dialog");
        });
        assert.ok(ok, `Tab ${i + 1}번째에 포커스가 배경 페이지로 나갔습니다`);
      }
    }));

  test("분류 칩과 필터 상태가 aria-pressed 로 전달된다", () =>
    run(async (page) => {
      assert.equal(await chip(page, "전체").getAttribute("aria-pressed"), "true");
      await chip(page, "카페").click();
      assert.equal(await chip(page, "카페").getAttribute("aria-pressed"), "true");
      assert.equal(await chip(page, "전체").getAttribute("aria-pressed"), "false");
    }));
});

describe("보조 정보", () => {
  test("공유 미리보기(OG) 메타와 매니페스트 링크가 있다", () =>
    run(async (page) => {
      const meta = (selector) => page.locator(selector).getAttribute("content");
      assert.equal(await meta('meta[property="og:title"]'), "교통대 꿀팁 모음");
      assert.equal(await meta('meta[property="og:image"]'), "https://skyhy0228.github.io/campuse_place/og.png");
      assert.equal(await meta('meta[name="twitter:card"]'), "summary_large_image");
      assert.ok(await page.locator('link[rel="manifest"]').getAttribute("href"));
      assert.equal(await page.locator("html").getAttribute("lang"), "ko");
      assert.ok(cards(page));
      assert.ok(places.length > 0);
    }));
});

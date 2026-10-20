import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
const PASSWORD = "Passw0rd9";
const ANSWER = "파랑이";

const headerButton = (page) => page.locator(".headerActions .account");
const dialog = (page) => page.locator("dialog[open]");
const tab = (page, name) => page.getByRole("group", { name: "계정 메뉴" }).getByRole("button", { name, exact: true });
const alertText = async (page) => (await dialog(page).getByRole("alert").first().innerText()).trim();

async function signup(page, { username = "tester01", password = PASSWORD, confirm = password, answer = ANSWER, importGuest } = {}) {
  await headerButton(page).click();
  await tab(page, "회원가입").click();
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(confirm);
  await page.getByLabel("질문의 답").fill(answer);
  if (importGuest === false) await dialog(page).getByRole("checkbox").uncheck();
  await dialog(page).getByRole("button", { name: "회원가입", exact: true }).last().click();
}

async function login(page, username, password, { remember = true } = {}) {
  await headerButton(page).click();
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  if (!remember) await dialog(page).getByLabel("로그인 유지").uncheck();
  await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
}

async function logout(page) {
  await headerButton(page).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForSelector("dialog[open]", { state: "detached" });
}

const loggedInAs = (page, username) => page.waitForFunction((name) => document.querySelector(".headerActions .accountName")?.textContent === name, username);
const favoriteButton = (page) => page.getByRole("button", { name: /^즐겨찾기 \d+$/ });

describe("회원가입", () => {
  test("가입하면 바로 로그인되고, 비밀번호와 답변 원문은 저장되지 않는다", () =>
    run(async (page) => {
      await signup(page);
      await loggedInAs(page, "tester01");

      const stored = await page.evaluate(() => localStorage.getItem("campuse:v1:users"));
      assert.ok(!stored.includes(PASSWORD), "비밀번호 원문이 저장되었습니다");
      assert.ok(!stored.includes(ANSWER), "답변 원문이 저장되었습니다");
      const [user] = JSON.parse(stored);
      assert.equal(user.username, "tester01");
      assert.ok(user.hash.length > 30 && user.salt && user.answerHash && user.answerSalt);
      assert.equal(user.iterations, 210000);
      assert.ok(!(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).includes(PASSWORD));

      await page.reload();
      await page.waitForSelector("article.card");
      await loggedInAs(page, "tester01");
    }));

  test("입력 검사: 약한 비밀번호, 확인 불일치, 잘못된 아이디, 중복 아이디", () =>
    run(async (page) => {
      await signup(page, { password: "short1" });
      assert.match(await alertText(page), /비밀번호는 영문과 숫자를 모두 포함해 8자 이상/);

      await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
      await page.getByLabel("비밀번호 확인", { exact: true }).fill("Different9");
      await dialog(page).getByRole("button", { name: "회원가입", exact: true }).last().click();
      assert.match(await alertText(page), /확인이 일치하지 않습니다/);

      await page.getByLabel("아이디", { exact: true }).fill("한글아이디");
      await page.getByLabel("비밀번호 확인", { exact: true }).fill(PASSWORD);
      await dialog(page).getByRole("button", { name: "회원가입", exact: true }).last().click();
      assert.match(await alertText(page), /아이디는 영문 소문자/);

      await page.getByLabel("아이디", { exact: true }).fill("tester01");
      await dialog(page).getByRole("button", { name: "회원가입", exact: true }).last().click();
      await loggedInAs(page, "tester01");
      await logout(page);

      await signup(page);
      assert.match(await alertText(page), /이미 사용 중인 아이디/);
    }));

  test("로그인 전 즐겨찾기를 계정으로 가져올 수 있다", () =>
    run(async (page) => {
      await cards(page).nth(0).locator("button[aria-pressed]").click();
      await cards(page).nth(1).locator("button[aria-pressed]").click();
      await headerButton(page).click();
      await tab(page, "회원가입").click();
      assert.match(await dialog(page).innerText(), /이 기기의 즐겨찾기 2곳을 내 계정으로 가져오기/);
      await dialog(page).getByRole("button", { name: "닫기" }).click();

      await signup(page);
      await loggedInAs(page, "tester01");
      assert.match(await favoriteButton(page).innerText(), /즐겨찾기 2/);
    }));
});

describe("로그인·로그아웃", () => {
  test("로그인하고 로그아웃하며, 틀린 비밀번호는 같은 문구로 안내한다", () =>
    run(async (page) => {
      await signup(page);
      await loggedInAs(page, "tester01");
      await logout(page);
      assert.equal((await headerButton(page).innerText()).trim(), "로그인");

      await login(page, "tester01", "Wrong1234");
      assert.equal(await alertText(page), "아이디 또는 비밀번호가 올바르지 않습니다.");
      await page.getByLabel("아이디", { exact: true }).fill("nobody99");
      await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
      assert.equal(await alertText(page), "아이디 또는 비밀번호가 올바르지 않습니다.");

      await page.getByLabel("아이디", { exact: true }).fill("TESTER01");
      await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
      await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
      await loggedInAs(page, "tester01");
    }));

  test("틀린 시도가 반복되면 잠시 막는다", () =>
    run(async (page) => {
      await signup(page);
      await logout(page);
      await login(page, "tester01", "Wrong1234");
      for (let i = 0; i < 5; i += 1) {
        await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
        await page.waitForTimeout(150);
      }
      await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
      await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
      assert.match(await alertText(page), /시도 횟수가 많습니다\. \d+초 뒤에 다시 시도하세요/);
    }));

  test("'로그인 유지'를 끄면 브라우저를 닫을 때까지만 유지된다", () =>
    run(async (page) => {
      await signup(page);
      await logout(page);
      await login(page, "tester01", PASSWORD, { remember: false });
      await loggedInAs(page, "tester01");
      assert.equal(await page.evaluate(() => localStorage.getItem("campuse:v1:session")), null);
      assert.ok(await page.evaluate(() => sessionStorage.getItem("campuse:v1:session")));
    }));
});

describe("개인 목록", () => {
  test("즐겨찾기는 계정마다 분리된다", () =>
    run(async (page) => {
      await signup(page, { username: "alice01" });
      await loggedInAs(page, "alice01");
      await cards(page).first().locator("button[aria-pressed]").click();
      assert.match(await favoriteButton(page).innerText(), /즐겨찾기 1/);
      await logout(page);
      assert.match(await favoriteButton(page).innerText(), /즐겨찾기 0/);

      await signup(page, { username: "bob0001" });
      await loggedInAs(page, "bob0001");
      assert.match(await favoriteButton(page).innerText(), /즐겨찾기 0/);
      await logout(page);

      await login(page, "alice01", PASSWORD);
      await loggedInAs(page, "alice01");
      assert.match(await favoriteButton(page).innerText(), /즐겨찾기 1/);
    }));

  test("내 목록을 만들어 담고, 목록별로 모아보고, 이름 변경·삭제한다", () =>
    run(async (page) => {
      await signup(page);
      await loggedInAs(page, "tester01");
      const target = places.find((p) => p.name === "밍거스 바베큐");

      await page.locator("article.card").getByRole("button", { name: target.name, exact: true }).click();
      await page.waitForSelector("dialog[open]");
      await page.getByRole("button", { name: "내 목록에 담기" }).click();
      await page.getByPlaceholder("새 목록 만들고 담기").fill("점심 후보");
      await page.getByRole("button", { name: "추가", exact: true }).click();
      assert.ok(await page.getByRole("checkbox", { name: "점심 후보" }).isChecked());
      await page.keyboard.press("Escape");
      await settle(page);

      assert.equal(await page.locator("#list option").count(), 2);
      await page.selectOption("#list", { label: "점심 후보 (1)" });
      await settle(page);
      assert.equal(await resultCount(page), 1);
      await page.waitForTimeout(500);
      assert.match(new URL(page.url()).searchParams.get("list") ?? "", /^c:c[0-9a-f]{12}$/);

      // 이름 변경
      await headerButton(page).click();
      await page.getByRole("button", { name: "점심 후보 이름 변경" }).click();
      await page.getByLabel("목록 이름", { exact: true }).fill("저녁 후보");
      await page.getByRole("button", { name: "저장", exact: true }).click();
      assert.ok(await dialog(page).getByText("저녁 후보").count());

      // 삭제
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "저녁 후보 삭제" }).click();
      await page.keyboard.press("Escape");
      await settle(page, 500);
      assert.equal(await page.locator("#list").count(), 0);
      assert.equal(await resultCount(page), places.length);
    }));

  test("로그인하지 않으면 '내 목록에 담기'가 로그인 화면으로 안내한다", () =>
    run(async (page) => {
      await cards(page).first().locator(".cardLink").click();
      await page.getByRole("button", { name: "내 목록에 담기" }).click();
      assert.equal(await page.locator("dialog[open]").count(), 2);
      assert.ok(await page.getByRole("heading", { name: "로그인" }).isVisible());
    }));

  test("내보내기와 가져오기 (잘못된 항목은 걸러낸다)", () =>
    run(async (page) => {
      await signup(page);
      await loggedInAs(page, "tester01");
      await cards(page).first().locator("button[aria-pressed]").click();
      await headerButton(page).click();

      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "내보내기" }).click()]);
      const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
      assert.equal(exported.app, "campuse-place");
      assert.equal(exported.favorites.length, 1);

      const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "import-")), "목록.json");
      fs.writeFileSync(
        file,
        JSON.stringify({
          favorites: [places[5].id, places[6].id, "<script>alert(1)</script>", 123],
          collections: [{ id: "c1", name: "가져온 목록", placeIds: [places[7].id, "bad"] }, { id: "../x", name: "나쁜 id", placeIds: [] }],
        }),
      );
      await page.setInputFiles('input[type="file"]', file);
      assert.match(await dialog(page).getByRole("status").innerText(), /즐겨찾기 2곳, 목록 1개/);
      const stored = JSON.parse(await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("campuse:v1:data:")))));
      assert.equal(stored.favorites.length, 3);
      assert.equal(stored.collections.length, 1);
      assert.deepEqual(stored.collections[0].placeIds, [places[7].id]);

      await page.setInputFiles('input[type="file"]', { name: "x.json", mimeType: "application/json", buffer: Buffer.from("not json") });
      assert.match(await dialog(page).getByRole("status").innerText(), /올바른 파일이 아닙니다/);
    }));
});

describe("비밀번호 찾기", () => {
  test("질문에 답하면 새 비밀번호를 정할 수 있다 (기존 비밀번호는 보여주지 않는다)", () =>
    run(async (page) => {
      await signup(page, { answer: "Blue Dog" });
      await loggedInAs(page, "tester01");
      await logout(page);

      await headerButton(page).click();
      await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
      await page.getByLabel("아이디", { exact: true }).fill("nobody99");
      await page.getByRole("button", { name: "다음" }).click();
      assert.match(await alertText(page), /찾을 수 없습니다/);

      await page.getByLabel("아이디", { exact: true }).fill("tester01");
      await page.getByRole("button", { name: "다음" }).click();
      assert.match(await dialog(page).innerText(), /초등학교 때 가장 친했던 친구의 이름은\?/);
      assert.ok(!(await dialog(page).innerText()).includes(PASSWORD));

      await page.getByLabel("질문의 답").fill("틀린 답");
      await page.getByLabel("새 비밀번호", { exact: true }).fill("NewPassw0rd");
      await page.getByLabel("새 비밀번호 확인").fill("NewPassw0rd");
      await page.getByRole("button", { name: "비밀번호 재설정" }).click();
      assert.match(await alertText(page), /답변이 일치하지 않습니다/);

      // 대소문자·띄어쓰기는 구분하지 않는다
      await page.getByLabel("질문의 답").fill("  blue   DOG ");
      await page.getByRole("button", { name: "비밀번호 재설정" }).click();
      await page.waitForSelector("text=비밀번호를 바꿨습니다");

      await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
      await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
      assert.match(await alertText(page), /올바르지 않습니다/);
      await page.getByLabel("비밀번호", { exact: true }).fill("NewPassw0rd");
      await dialog(page).locator("form").getByRole("button", { name: "로그인", exact: true }).click();
      await loggedInAs(page, "tester01");
    }));
});

describe("계정 삭제", () => {
  test("비밀번호를 확인한 뒤 계정과 목록을 지운다", () =>
    run(async (page) => {
      await signup(page);
      await loggedInAs(page, "tester01");
      await cards(page).first().locator("button[aria-pressed]").click();
      await headerButton(page).click();
      await page.getByRole("button", { name: "계정 삭제" }).click();
      await page.getByPlaceholder("비밀번호").fill("Wrong1234");
      await page.getByRole("button", { name: "삭제하기" }).click();
      assert.match(await alertText(page), /비밀번호가 올바르지 않습니다/);

      await page.getByPlaceholder("비밀번호").fill(PASSWORD);
      await page.getByRole("button", { name: "삭제하기" }).click();
      await page.waitForSelector("dialog[open]", { state: "detached" });
      assert.equal((await headerButton(page).innerText()).trim(), "로그인");
      assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("campuse:v1:users"))).length, 0);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("campuse:v1:data:")).length), 0);
    }));
});

describe("모바일", () => {
  test("로그인 화면이 화면 안에 들어오고 가로로 넘치지 않는다", () =>
    run(async (page) => {
      await headerButton(page).click();
      await tab(page, "회원가입").click();
      await settle(page, 400);
      const box = await dialog(page).boundingBox();
      assert.ok(box.x >= -0.5 && box.x + box.width <= 390.5 && box.y + box.height <= 844.5);
      assert.ok((await dialog(page).evaluate((el) => el.scrollWidth - el.clientWidth)) <= 0);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    }, { viewport: { width: 390, height: 844 } }));
});

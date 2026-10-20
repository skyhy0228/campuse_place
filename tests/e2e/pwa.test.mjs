import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { BASE, cards, launchBrowser, places, startServer, withPage } from "./helpers.mjs";

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

describe("앱 설치(PWA)", () => {
  test("매니페스트와 아이콘이 모두 존재한다", async () => {
    const response = await fetch(`${BASE}manifest.webmanifest`);
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.equal(manifest.name, "교통대 꿀팁 모음");
    assert.equal(manifest.display, "standalone");
    assert.ok(manifest.icons.some((i) => i.sizes === "512x512") && manifest.icons.some((i) => i.purpose === "maskable"));
    for (const icon of manifest.icons) {
      const res = await fetch(new URL(icon.src, `${BASE}manifest.webmanifest`));
      assert.equal(res.status, 200, icon.src);
      assert.match(res.headers.get("content-type"), /image\/png/);
    }
    assert.equal((await fetch(`${BASE}og.png`)).status, 200);
  });

  test("서비스 워커가 등록되고, 오프라인에서도 열어본 화면이 열린다", async () => {
    await withPage(
      browser,
      async (page, context) => {
        await page.evaluate(() => navigator.serviceWorker.ready);
        // 서비스 워커가 제어하는 상태에서 한 번 더 열어 데이터와 화면을 저장한다.
        await page.reload();
        await page.waitForSelector("article.card");
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForTimeout(800);

        await context.setOffline(true);
        await page.reload();
        await page.waitForSelector("article.card", { timeout: 10_000 });
        assert.equal(await cards(page).count(), places.length);
        await context.setOffline(false);
      },
      { serviceWorkers: "allow", checkErrors: false },
    );
  });
});

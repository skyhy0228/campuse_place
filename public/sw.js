// 오프라인에서도 한 번 열어본 화면을 볼 수 있게 하는 서비스 워커.
// - 페이지(HTML)와 데이터(places.json)는 네트워크 우선: 배포된 최신 내용을 먼저 쓰고, 실패하면 저장본을 쓴다.
// - 해시가 붙은 빌드 파일(assets/)·이미지·아이콘은 저장본 우선.
// - 그 외 같은 출처의 GET 요청은 저장본을 먼저 보여주고 뒤에서 갱신한다.
const CACHE = "campuse-place-v1";
const BASE = new URL("./", self.location).pathname;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([BASE, `${BASE}favicon.svg`])).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const store = async (request, response) => {
  if (response.ok && response.status === 200) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

async function networkFirst(request, fallbackUrl) {
  try {
    return await store(request, await fetch(request));
  } catch (error) {
    const cached = (await caches.match(request)) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  return (await caches.match(request)) || store(request, await fetch(request));
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const update = fetch(request).then((response) => store(request, response)).catch(() => cached);
  return cached || update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") event.respondWith(networkFirst(request, BASE));
  else if (url.pathname === `${BASE}data/places.json`) event.respondWith(networkFirst(request));
  else if (/^(assets|images|icons)\//.test(url.pathname.slice(BASE.length))) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});

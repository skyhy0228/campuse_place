// 검색 중심 첫 화면의 검색 규칙 (src/lib/search.ts). 실제 데이터(places.json)와 소주제 사전(topics.json)으로 확인한다.
// places.json 은 npm run data 로 만들어지므로, 이 테스트 전에 변환이 한 번 돌아 있어야 한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { toChoseong } from "../../src/lib/choseong.ts";
import { buildTopicIndex, searchDocs } from "../../src/lib/search.ts";

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const places = read("../../public/data/places.json").places;
const dict = read("../../data/topics.json");
const assign = read("../../data/topic-assign.json");
const index = buildTopicIndex(dict);

const norm = (s) => s.normalize("NFC").toLowerCase();
const docs = places.map((p) => ({
  id: p.id,
  name: p.name,
  haystack: norm([p.name, p.location, p.summary, p.details, p.menu, ...Object.values(p.zh ?? {})].join("\n")),
  choseong: toChoseong([p.name, p.menu].join(" ")),
  subtopic: p.subtopic,
  recommendations: p.recommendations,
  isFood: p.category === "식당" || p.category === "카페",
}));
const nameOf = (id) => places.find((p) => p.id === id)?.name;
const run = (q) => searchDocs(docs, index, q);

test("데이터: 음식점이 아닌 항목은 모두 소주제가 있고, 숨긴 항목은 빠진다", () => {
  const nonFood = places.filter((p) => p.category !== "식당" && p.category !== "카페");
  assert.ok(nonFood.length > 200);
  assert.deepEqual(nonFood.filter((p) => !p.subtopic).map((p) => p.name), []);
  for (const id of Object.keys(assign.hidden)) assert.ok(!places.some((p) => p.id === id), `숨김 항목이 남아 있음: ${id}`);
  assert.ok(!places.some((p) => p.name === "술집 리스트"));
});

test("데이터: 소주제의 교내·교외 범위가 붙고, 999번은 양쪽에 보인다", () => {
  const byName = (n) => places.find((p) => p.name === n);
  assert.equal(byName("999번 버스").scope, "both");
  assert.equal(byName("버스").scope, "both");
  assert.equal(byName("한국교통대(회차지)").scope, "out");
  assert.equal(byName("캐럴실").scope, "in");
  assert.equal(byName("수강 철회하는 법").scope, "info");
  assert.equal(byName("세탁방 리스트").subtopic, "out-living");
});

test("'택시 싸게' → 첫 묶음이 교통비 아끼기이고 맨 위가 택시 할인", () => {
  const r = run("택시 싸게");
  assert.equal(r.groups[0].key, "money-transport");
  assert.equal(nameOf(r.order[0]), "택시 할인");
});

test("'할인' → 소주제 묶음이 3개 이상이고 💰 묶음이 먼저 나온다", () => {
  const r = run("할인");
  assert.ok(r.groups.length >= 3, `묶음 ${r.groups.length}개`);
  assert.ok(["money-discount", "money-transport", "money-living"].includes(r.groups[0].key));
  assert.equal(r.flat, false);
});

test("초성 검색: 'ㅅㄱㅊㅎ' → 수강 철회하는 법", () => {
  const r = run("ㅅㄱㅊㅎ");
  assert.ok(r.order.map(nameOf).includes("수강 철회하는 법"));
});

test("중국어 키워드: '打印' → 출력·행정 묶음", () => {
  const r = run("打印");
  assert.ok(r.total > 0);
  assert.equal(r.groups[0].key, "in-print");
});

test("여러 단어는 모두 맞아야 한다 (절약 신호어는 예외)", () => {
  const r = run("보건실 무료");
  assert.ok(r.total > 0);
  for (const id of r.order) {
    const doc = docs.find((d) => d.id === id);
    const words = index.get(doc.subtopic)?.words ?? [];
    assert.ok(doc.haystack.includes("보건실") || words.includes("보건실"), `보건실과 무관한 결과: ${doc.name}`);
  }
});

test("결과가 5개 이하면 묶지 않고 바로 나열한다", () => {
  const r = run("캐럴실");
  assert.ok(r.total >= 1 && r.total <= 5);
  assert.equal(r.flat, true);
});

test("맛집은 'food' 묶음으로 나온다", () => {
  const r = run("짬뽕");
  assert.ok(r.total > 0);
  assert.ok(r.groups.every((g) => g.key === "food"));
});

test("빈 검색어와 결과 없음", () => {
  assert.equal(run("   ").total, 0);
  assert.equal(run("ㅋㅋㅋㅋㅋㅋㅋ").total, 0);
});

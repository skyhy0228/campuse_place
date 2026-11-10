import assert from "node:assert/strict";
import { test } from "node:test";
import { foodPhoto, foodType } from "../../scripts/lib/food.mjs";
import {
  CAMPUS_SIZE,
  campusPosition,
  createMatcher,
  extractReviewKeywords,
  gyotongCoordinate,
  gyotongFields,
  knutFields,
  nameKeys,
  toCampusXY,
} from "../../scripts/lib/teams.mjs";

test("nameKeys: 공백·괄호·지점 표기·학교 이름을 뗀 키를 만든다", () => {
  assert.deepEqual(nameKeys("부리또인 충주교통대점"), ["부리또인충주교통대점", "부리또인"]);
  assert.deepEqual(nameKeys("친구분식 (대학로 친구분식)"), ["친구분식"]);
  assert.ok(nameKeys("한국교통대학교 충주캠퍼스대원생활관").includes("대원생활관"));
  // 떼고 남는 글자가 너무 짧으면 키로 쓰지 않는다.
  assert.deepEqual(nameKeys("본점"), ["본점"]);
});

test("createMatcher: 이름·별칭으로 연결하고 한 항목은 한 번만 쓴다", () => {
  const entries = [{ name: "부리또인" }, { name: "DROP BY" }, { name: "권짬뽕 충주교통대점" }];
  const m = createMatcher(entries, { names: (e) => [e.name], aliases: { "DROP BY": "드랍바이" } });
  assert.equal(m.match(["부리또인 충주교통대점"])?.name, "부리또인");
  assert.equal(m.match(["드랍바이"])?.name, "DROP BY");
  assert.equal(m.match(["권짬뽕"])?.name, "권짬뽕 충주교통대점");
  assert.equal(m.match(["부리또인 충주교통대점"]), null);
  assert.equal(m.match(["없는 가게"]), null);
  assert.deepEqual(m.unmatched(), []);
});

test("extractReviewKeywords: 리뷰 키워드와 건수를 많은 순으로 꺼낸다", () => {
  assert.deepEqual(extractReviewKeywords('리뷰 키워드는 "가성비가 좋아요"(70건)와 "혼밥하기 좋아요"(51건)가 많다.'), [
    { label: "가성비가 좋아요", count: 70 },
    { label: "혼밥하기 좋아요", count: 51 },
  ]);
  assert.deepEqual(extractReviewKeywords('"디저트가 맛있어요"(1,909건)'), [{ label: "디저트가 맛있어요", count: 1909 }]);
  assert.deepEqual(extractReviewKeywords('"혼밥하기 좋아요" 키워드가 500건이 넘으며'), [{ label: "혼밥하기 좋아요", count: 500, over: true }]);
  assert.deepEqual(extractReviewKeywords('리뷰에서 "양이 많아요"가 많다.'), []);
  assert.deepEqual(extractReviewKeywords(null), []);
});

test("gyotongFields: 값이 있는 것만 붙이고 '확인 필요'는 버린다", () => {
  const fields = gyotongFields({
    zone: "교통대 앞",
    rating: 4,
    soloDining: "좋음",
    closedDays: "확인 필요",
    distanceKm: 0.7,
    summary: "요약",
    detail: '"친절해요"(3건)',
  });
  assert.deepEqual(fields, {
    zone: "front",
    baseRating: 4,
    solo: "good",
    distanceKm: 0.7,
    reviewKeywords: [{ label: "친절해요", count: 3 }],
    review: { summary: "요약", detail: '"친절해요"(3건)' },
  });
  assert.equal(gyotongCoordinate({ address: "충북 충주시 대소원면 대학로 50", lat: 36.96, lng: 127.87 }), null);
  assert.deepEqual(gyotongCoordinate({ address: "충북 충주시 대소원면 대학로 13", lat: 36.964089, lng: 127.8707737 }), {
    lat: 36.964089,
    lng: 127.8707737,
  });
});

test("knutFields: 미확인 값은 빼고 유학생 추천 표시를 떼어 낸다", () => {
  const fields = knutFields({
    name_zh: "核饭",
    address_zh: "未确认",
    menu_zh: "盖饭",
    hours_zh: "",
    note_zh: "【留学生亲测】可以用平板点餐",
    intlPick: true,
    intlTipKo: "태블릿 주문",
    intlTipZh: "平板点餐",
  });
  assert.deepEqual(fields, {
    zh: { name: "核饭", menu: "盖饭", note: "可以用平板点餐" },
    intl: { ko: "태블릿 주문", zh: "平板点餐" },
  });
  assert.deepEqual(knutFields({ name_zh: "" }), {});
});

test("toCampusXY: ut 캠퍼스 지도와 같은 크기·투영을 쓴다", () => {
  assert.deepEqual(CAMPUS_SIZE, { w: 1468, h: 1990 });
  const corner = toCampusXY(36.9765, 127.8635);
  assert.deepEqual(corner, { x: 0, y: 0 });
  assert.equal(toCampusXY(36.95, 127.87), null);
  assert.deepEqual(campusPosition({ x: 10, y: 20, b: "E5" }, { lat: 36.97, lng: 127.87 }), { x: 10, y: 20, building: "E5" });
  assert.deepEqual(campusPosition({ x: 10, y: 20 }, null), { x: 10, y: 20, approx: true });
  assert.equal(campusPosition(null, null), null);
});

test("foodType / foodPhoto: 예외 → 규칙 순으로 음식 종류와 변형 사진을 고른다", () => {
  assert.equal(foodType({ name: "부리또인 충주교통대점", menu: "부리또", category: "식당" }), "burrito");
  assert.equal(foodType({ name: "만선식당", menu: "오징어볶음", category: "식당" }), "rice");
  assert.equal(foodType({ name: "커피단월", category: "카페" }), "bread");
  assert.equal(foodType({ name: "카페샵오팔", menu: "빙수", category: "카페" }), "dessert");
  assert.equal(foodType({ name: "어딘가", category: "주점" }), "pub");
  assert.equal(foodType({ name: "이름만 있는 식당", menu: "", category: "식당" }), "");
  assert.equal(foodPhoto({ name: "생각나는감자탕", menu: "뼈해장국, 감자탕" }, "gukbap"), "gukbap-bone");
  assert.equal(foodPhoto({ name: "국밥집", menu: "순대국" }, "gukbap"), "gukbap");
  assert.equal(foodPhoto({ name: "x" }, ""), "");
});

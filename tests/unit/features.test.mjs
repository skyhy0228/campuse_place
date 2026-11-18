// 새 기능의 순수 함수: 랜덤 추천, 거리, 목록 공유 링크, 날짜·오래된 정보, 버스 시간표, 정보 수정 반영
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTimes, runsOn, upcoming, minutesUntil } from "../../src/lib/bus.ts";
import { addDays, daysSince, isStaleDate, kstDateString, latestDate, weekDays, weekRange } from "../../src/lib/dates.ts";
import { SCHOOL, compareDistance, distanceMeters, formatDistance } from "../../src/lib/nearby.ts";
import { applyChanges, cleanChanges, groupOverrides } from "../../src/lib/overrides.ts";
import { pickOne, rememberPick } from "../../src/lib/pick.ts";
import { sharedListFromParams, sharedListUrl } from "../../src/lib/shareList.ts";
import { latLngFromCampusXY, campusXYFromLatLng } from "../../src/lib/campus.ts";

test("pickOne: 최근에 뽑힌 곳은 후보가 남아 있으면 피하고, 후보가 없으면 null", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(pickOne([], []), null);
  // random()=0 이면 남은 후보 중 첫 번째
  assert.equal(pickOne(pool, ["a", "b"], () => 0).id, "c");
  assert.equal(pickOne(pool, [], () => 0.99).id, "c");
  // 후보가 하나뿐이면 최근 기록과 상관없이 그것을 준다
  assert.equal(pickOne([{ id: "a" }], ["a"], () => 0).id, "a");
  // 후보 2개: 마지막에 뽑힌 곳(a)만 피한다
  assert.equal(pickOne([{ id: "a" }, { id: "b" }], ["a", "b"], () => 0).id, "b");
  assert.deepEqual(rememberPick(["a", "b"], "b"), ["b", "a"]);
  assert.equal(rememberPick(["1", "2", "3", "4", "5"], "6").length, 5);
});

test("distanceMeters·formatDistance: 직선거리와 표시 형식, 모르는 거리는 뒤로", () => {
  assert.equal(distanceMeters(SCHOOL, SCHOOL), 0);
  // 위도 0.01도 ≈ 1.11km
  const d = distanceMeters({ lat: 36.9688, lng: 127.8728 }, { lat: 36.9788, lng: 127.8728 });
  assert.ok(d > 1100 && d < 1125, String(d));
  assert.equal(formatDistance(3), "10m");
  assert.equal(formatDistance(347), "350m");
  assert.equal(formatDistance(1234), "1.2km");
  assert.ok(compareDistance(1, 2) < 0);
  assert.ok(compareDistance(undefined, 2) > 0);
  assert.ok(compareDistance(2, undefined) < 0);
  assert.equal(compareDistance(undefined, undefined), 0);
});

test("latLngFromCampusXY: 캠퍼스 좌표 변환의 역변환", () => {
  const xy = campusXYFromLatLng(SCHOOL.lat, SCHOOL.lng);
  const back = latLngFromCampusXY(xy.x, xy.y);
  assert.ok(Math.abs(back.lat - SCHOOL.lat) < 1e-5 && Math.abs(back.lng - SCHOOL.lng) < 1e-5);
});

test("공유 링크: 형식이 맞는 ID 만 읽고 이름은 자른다", () => {
  const url = sharedListUrl("https://example.com/campuse_place/", { name: "점심 후보", ids: ["p0b6d6685", "q12345678"] });
  assert.equal(url, "https://example.com/campuse_place/?list=shared&ln=%EC%A0%90%EC%8B%AC+%ED%9B%84%EB%B3%B4&ids=p0b6d6685%2Cq12345678");
  const parsed = sharedListFromParams(new URL(url).searchParams);
  assert.deepEqual(parsed, { name: "점심 후보", ids: ["p0b6d6685", "q12345678"] });

  const messy = sharedListFromParams(new URLSearchParams(`ln=${"가".repeat(50)}%0A&ids=p0b6d6685,<script>,p0b6d6685,PZZZ`));
  assert.equal(messy.name.length, 30);
  assert.deepEqual(messy.ids, ["p0b6d6685"]);
  assert.equal(sharedListFromParams(new URLSearchParams("ids=nope")), null);
  assert.equal(sharedListFromParams(new URLSearchParams("")), null);
});

test("dates: 한국 날짜, 주 범위, 오래된 정보 판단", () => {
  // 한국 시간 11월 18일 01:00 (UTC 11월 17일 16:00)
  assert.equal(kstDateString(new Date("2026-11-17T16:00:00Z")), "2026-11-18");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(weekRange("2026-11-18"), { start: "2026-11-16", end: "2026-11-22" });
  assert.deepEqual(weekRange("2026-11-22"), { start: "2026-11-16", end: "2026-11-22" });
  assert.equal(weekDays("2026-11-18").length, 7);
  assert.equal(latestDate("2026-10-06", undefined, "2026-11-01", "잘못된값"), "2026-11-01");
  assert.equal(latestDate(undefined, ""), "");

  const now = new Date("2026-11-17T03:00:00Z");
  assert.equal(daysSince("2026-11-17", now), 0);
  assert.equal(isStaleDate("2026-10-06", now), false);
  assert.equal(isStaleDate("2026-05-20", now), true);
  assert.equal(isStaleDate("2026-05-21", now), false); // 정확히 180일은 아직 오래되지 않음
  assert.equal(isStaleDate("", now), false);
});

test("bus: 시각 읽기, 요일 판단, 다음 출발", () => {
  assert.deepEqual(parseTimes("7:30, 08:10\n12시 5분 / 25:00 08:10 9:61"), ["07:30", "08:10", "12:05"]);
  assert.equal(runsOn("weekday", 1), true);
  assert.equal(runsOn("weekday", 6), false);
  assert.equal(runsOn("weekend", 0), true);
  assert.equal(runsOn("everyday", 3), true);
  const times = ["07:30", "08:10", "12:05", "18:00"];
  assert.deepEqual(upcoming(times, 8 * 60, 2), ["08:10", "12:05"]);
  assert.deepEqual(upcoming(times, 19 * 60), []);
  assert.equal(minutesUntil("08:10", 8 * 60), 10);
});

const base = {
  id: "p0b6d6685",
  name: "테스트 식당",
  category: "식당",
  location: "대학로 1",
  locationNotes: ["정문 옆"],
  campus: "out",
  mapUrl: "",
  hours: "매일 11:00~21:00",
  schedule: null,
  price: "9,000원",
  priceBand: "under10",
  menu: "김치찌개",
  summary: "",
  details: "",
  recommendations: 2,
  checkedAt: "2026-10-06",
  checkedSort: "2026-10-06",
  images: [],
  zh: { name: "测试", hours: "每天", menu: "泡菜汤" },
};

test("cleanChanges: 정해진 칸만 받고 빈 값은 버린다", () => {
  assert.deepEqual(cleanChanges({ hours: "  월~금 10:00~20:00 ", price: "", evil: "x", closed: "true" }), { hours: "월~금 10:00~20:00" });
  assert.deepEqual(cleanChanges({ closed: true }), { closed: true });
  assert.equal(cleanChanges({ hours: "   " }), null);
  assert.equal(cleanChanges(null), null);
  assert.equal(cleanChanges(["hours"]), null);
  assert.equal(cleanChanges({ menu: "가".repeat(300) }).menu.length, 200);
});

test("applyChanges: 운영시간·가격을 다시 해석하고, 바뀐 칸의 중국어 번역은 지운다", () => {
  const next = applyChanges(base, { hours: "월~금 10:00~20:00", price: "12,000원" }, "2026-11-10T05:00:00Z");
  assert.equal(next.hours, "월~금 10:00~20:00");
  assert.deepEqual(next.schedule[1], [600, 1200]);
  assert.equal(next.schedule[0], null);
  assert.equal(next.priceBand, "10to20");
  assert.equal(next.zh.hours, undefined);
  assert.equal(next.zh.menu, "泡菜汤");
  assert.equal(next.checkedSort, "2026-11-10");
  assert.equal(next.changedAt, "2026-11-10");
  // 원본은 그대로
  assert.equal(base.hours, "매일 11:00~21:00");

  const unclear = applyChanges(base, { hours: "가끔 엶" }, "2026-11-10T05:00:00Z");
  assert.equal(unclear.schedule, null);

  const moved = applyChanges(base, { location: "대학로 2", closed: true }, "2026-11-10T05:00:00Z");
  assert.equal(moved.location, "대학로 2");
  assert.deepEqual(moved.locationNotes, []);
  assert.equal(moved.closed, true);
});

test("groupOverrides: 승인 순서대로 모으고 잘못된 값은 건너뛴다", () => {
  const map = groupOverrides([
    { place_id: "p0b6d6685", changes: { price: "2" }, reviewed_at: "2026-11-02T00:00:00Z" },
    { place_id: "p0b6d6685", changes: { price: "1" }, reviewed_at: "2026-11-01T00:00:00Z" },
    { place_id: "p17bb25f2", changes: { nope: 1 }, reviewed_at: "2026-11-01T00:00:00Z" },
  ]);
  assert.deepEqual(
    map.get("p0b6d6685").map((x) => x.changes.price),
    ["1", "2"],
  );
  assert.equal(map.has("p17bb25f2"), false);
});

// src/lib/geo.ts 는 다른 모듈을 가져오지 않는 순수 함수라 Node 의 타입 제거로 바로 불러온다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceFrom, distanceMeters, formatDistance, sortByDistance, walkMinutes } from "../../src/lib/geo.ts";

const SCHOOL = { lat: 36.9688, lng: 127.8728 }; // 대학본부 근처

test("distanceMeters: 하버사인 직선거리", () => {
  assert.equal(distanceMeters(SCHOOL, SCHOOL), 0);
  // 위도 0.01도 ≈ 1.11km
  const d = distanceMeters(SCHOOL, { lat: SCHOOL.lat + 0.01, lng: SCHOOL.lng });
  assert.ok(Math.abs(d - 1112) < 5, String(d));
  // 서울시청까지 약 90km
  const seoul = distanceMeters(SCHOOL, { lat: 37.5663, lng: 126.9779 });
  assert.ok(seoul > 95_000 && seoul < 110_000, String(seoul));
});

test("distanceFrom: 위치나 좌표가 없으면 undefined", () => {
  assert.equal(distanceFrom(null, SCHOOL), undefined);
  assert.equal(distanceFrom(SCHOOL, {}), undefined);
  assert.equal(distanceFrom(SCHOOL, { lat: 1 }), undefined);
  assert.equal(distanceFrom(SCHOOL, SCHOOL), 0);
});

test("formatDistance·walkMinutes", () => {
  assert.equal(formatDistance(3), "10m");
  assert.equal(formatDistance(347), "350m");
  assert.equal(formatDistance(1234), "1.2km");
  assert.equal(formatDistance(23_456), "23km");
  assert.equal(walkMinutes(10), 1);
  assert.equal(walkMinutes(670), 10);
});

test("sortByDistance: 가까운 순, 좌표 없는 항목은 뒤에서 기본 순서", () => {
  const items = [
    { id: "none-b", rec: 1 },
    { id: "far", lat: SCHOOL.lat + 0.05, lng: SCHOOL.lng, rec: 9 },
    { id: "none-a", rec: 5 },
    { id: "near", lat: SCHOOL.lat + 0.001, lng: SCHOOL.lng, rec: 0 },
    { id: "same-2", lat: SCHOOL.lat + 0.01, lng: SCHOOL.lng, rec: 2 },
    { id: "same-7", lat: SCHOOL.lat + 0.01, lng: SCHOOL.lng, rec: 7 },
  ];
  const sorted = sortByDistance(items, SCHOOL, (a, b) => b.rec - a.rec);
  assert.deepEqual(sorted.map((x) => x.id), ["near", "same-7", "same-2", "far", "none-a", "none-b"]);
  assert.equal(items[0].id, "none-b", "원본 배열은 바꾸지 않는다");
});

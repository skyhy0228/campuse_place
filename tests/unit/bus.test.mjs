// src/lib/bus.ts 는 순수 함수라 Node 의 타입 제거로 바로 불러온다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { boardingStops, departures, kst, minutesUntil, parseNote, serviceDay, toMinutes, upcoming } from "../../src/lib/bus.ts";

const data = JSON.parse(fs.readFileSync(new URL("../../public/data/bus.json", import.meta.url), "utf8"));
const route = (id) => data.routes.find((r) => r.id === id);
// 한국 시각 → Date
const at = (s) => new Date(`${s}+09:00`);

test("시간표 데이터: 형식과 순서", () => {
  for (const r of data.routes) {
    for (const t of r.trips) {
      assert.equal(t.times.length, r.stops.length, `${r.id} 정류장 수`);
      const ts = t.times.filter(Boolean);
      assert.ok(ts.every((x) => /^\d{2}:\d{2}$/.test(x)));
      assert.ok(ts.every((x, i) => i === 0 || toMinutes(x) > toMinutes(ts[i - 1])), `${r.id} ${ts} 시간 순서`);
      if (t.note) assert.ok(parseNote(t.note), t.note);
    }
  }
  assert.equal(route("999-city").trips.length, 20);
  assert.equal(route("999-school").trips.length, 22);
  assert.equal(route("700").trips.length, 4);
});

test("kst: 기기 시간대와 상관없이 한국 날짜·요일", () => {
  assert.deepEqual(kst(new Date("2026-11-17T15:30:05Z")), { ymd: "2026-11-18", day: 3, seconds: 30 * 60 + 5 });
});

test("serviceDay: 주말·공휴일·운행 안 하는 기간", () => {
  assert.equal(serviceDay(data, at("2026-11-17T10:00")).status, "service");
  assert.equal(serviceDay(data, at("2026-11-21T10:00")).status, "weekend");
  assert.equal(serviceDay(data, at("2026-12-25T10:00")).status, "holiday");
  assert.equal(serviceDay(data, at("2026-12-25T10:00")).holidaysKnown, true);
  assert.equal(serviceDay(data, at("2027-01-05T10:00")).holidaysKnown, false);
  const off = { ...data, noService: [{ from: "2026-12-22", to: "2027-02-28", label: "겨울방학" }] };
  assert.deepEqual(serviceDay(off, at("2026-12-22T09:00")), { status: "noService", holidaysKnown: true, label: "겨울방학" });
  assert.equal(serviceDay(off, at("2026-12-21T09:00")).status, "service");
});

test("boardingStops: 마지막 정류장과 시간이 없는 정류장은 탈 곳에서 뺀다", () => {
  assert.deepEqual(boardingStops(route("999-city")), [0, 1]);
  assert.deepEqual(boardingStops(route("999-school")), [0, 1]);
  assert.deepEqual(boardingStops(route("700")), [0, 1, 2, 3, 4, 5]);
});

test("upcoming·minutesUntil: 다음 버스", () => {
  const r = route("999-city");
  const now = kst(at("2026-11-17T18:40:30")).seconds;
  const next = upcoming(r, 0, now);
  assert.deepEqual(next.map((d) => d.time), ["18:47", "20:30"]);
  assert.equal(minutesUntil(next[0], now), 7);
  // 출발 시각이 된 그 분까지는 남는다
  const same = kst(at("2026-11-17T18:47:40")).seconds;
  assert.equal(upcoming(r, 0, same)[0].time, "18:47");
  assert.equal(minutesUntil(upcoming(r, 0, same)[0], same), 0);
  assert.equal(upcoming(r, 0, kst(at("2026-11-17T21:00")).seconds).length, 0);
  // 직행은 충주역 시간이 없어 충주역 출발 목록에서 빠진다
  assert.ok(!departures(route("999-school"), 1).some((d) => d.time === "15:00"));
  assert.equal(departures(route("999-school"), 0).length, 21); // 22회 중 차고지 출발 직행 1회는 터미널 시각이 없다
});

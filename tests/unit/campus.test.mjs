// src/lib/campus.ts 는 타입만 쓰는 순수 함수라 Node 의 타입 제거(--experimental-strip-types)로 바로 불러온다.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { aliasTable, floorHas, parseRoomQuery, searchDepartments } from "../../src/lib/campus.ts";

const data = JSON.parse(fs.readFileSync(new URL("../../public/data/campus.json", import.meta.url), "utf8"));

test("parseRoomQuery: 건물 번호와 강의실 번호에서 층을 찾는다", () => {
  assert.deepEqual(parseRoomQuery("E5-213", data), { code: "E5", room: "213", floor: "2" });
  assert.deepEqual(parseRoomQuery("e5 213", data), { code: "E5", room: "213", floor: "2" });
  assert.deepEqual(parseRoomQuery("테크노관 213", data), { code: "E5", room: "213", floor: "2" });
  assert.deepEqual(parseRoomQuery("W20 1013", data), { code: "W20", room: "1013", floor: "10" });
  assert.deepEqual(parseRoomQuery("E5 지하 105", data), { code: "E5", room: "B105", floor: "지하 1" });
  assert.deepEqual(parseRoomQuery("테크노관", data), { code: "E5" });
});

test("parseRoomQuery: 건물이 아니면 null (낱말 속 e·w 는 건물 번호로 보지 않는다)", () => {
  assert.equal(parseRoomQuery("부리또", data), null);
  assert.equal(parseRoomQuery("cafe 2", data), null);
  assert.equal(parseRoomQuery("E99 101", data), null);
  assert.equal(parseRoomQuery("", data), null);
});

test("aliasTable: 긴 이름부터 맞춘다", () => {
  const table = aliasTable(data);
  for (let i = 1; i < table.length; i += 1) assert.ok(table[i - 1].key.length >= table[i].key.length);
  assert.ok(table.some((a) => a.key === "테크노관" && a.code === "E5"));
});

test("floorHas: 범위 층 표기를 이해한다", () => {
  assert.ok(floorHas("1~9", "3"));
  assert.ok(!floorHas("1~9", "10"));
  assert.ok(floorHas("2", "2"));
  assert.ok(!floorHas("2", "지하 1"));
});

test("searchDepartments: 학과 이름으로 건물과 층을 찾는다", () => {
  const found = searchDepartments("자동차공학", data);
  assert.ok(found.length >= 1);
  assert.equal(found[0].code, "E5");
  assert.deepEqual(searchDepartments("ㄱ", data), []);
});

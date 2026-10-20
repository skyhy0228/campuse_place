import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCampus,
  cleanMenu,
  cleanName,
  cleanSummary,
  parseChecked,
  parseHours,
  parsePrice,
  priceBand,
  splitLocation,
} from "../../scripts/lib/derive.mjs";

test("cleanName: 폴더명 접두어와 밑줄을 정리한다", () => {
  assert.equal(cleanName("3_생활꿀팁_동아리 신청"), "동아리 신청");
  assert.equal(cleanName("3_생활꿀팁_일본어 회화 수업_일본 교환학생 기회"), "일본어 회화 수업 · 일본 교환학생 기회");
  assert.equal(cleanName("카페_리스트"), "카페 리스트");
  assert.equal(cleanName("쇼쿠스시 충주호암점"), "쇼쿠스시 충주호암점");
});

test("cleanSummary: 자동 문구는 상세 첫 문단으로 대체하고, 없으면 비운다", () => {
  assert.equal(cleanSummary("ICT관 지름길에 관한 생활 정보", "ICT관 지름길 / 건물 사이 고가길로 가면 빠르다", "ICT관 지름길"), "건물 사이 고가길로 가면 빠르다");
  assert.equal(cleanSummary("OO 이용에 참고할 수 있는 장소 정보", "", "OO"), "");
  assert.equal(cleanSummary("식사 메뉴를 제공하는 식당", "", "OO"), "");
  assert.equal(cleanSummary("콩나물국밥 등을 제공하는 식당", "", "OO"), "콩나물국밥 등을 제공하는 식당");
  // 날짜 줄, 제목 표시, 너무 짧은 조각은 요약으로 쓰지 않는다
  assert.equal(cleanSummary("OO에 관한 생활 정보", "확인날짜 2026-10-06 / <영화관 팁> / 중식 / 주차는 정문 옆 광장에 하면 된다", "OO"), "주차는 정문 옆 광장에 하면 된다");
  assert.equal(cleanSummary("OO에 관한 생활 정보", "2026-10-06 / 확인한 날: 2026-10-06", "OO"), "");
});

test("cleanMenu: 다른 항목에 포함되는 항목과 중복을 제거한다", () => {
  assert.equal(cleanMenu("밍거스 플레이트, 파히타, 1인 바베큐, 타코, 플레이트, 플레이트 밍거스 플레이트"), "파히타, 1인 바베큐, 타코, 플레이트 밍거스 플레이트");
  assert.equal(cleanMenu("라면, 라면, 덮밥"), "라면, 덮밥");
  assert.equal(cleanMenu(""), "");
});

test("parseChecked: 날짜 형식을 정리한다", () => {
  assert.deepEqual(parseChecked("2026-10-06"), { display: "2026-10-06", sort: "2026-10-06" });
  assert.deepEqual(parseChecked("26-10-06"), { display: "2026-10-06", sort: "2026-10-06" });
  assert.deepEqual(parseChecked("2026-8"), { display: "2026-08", sort: "2026-08-01" });
  assert.deepEqual(parseChecked("2026 - 10"), { display: "2026-10", sort: "2026-10-01" });
  assert.deepEqual(parseChecked("2026-02-31"), { display: "2026-02-31", sort: "" });
  assert.deepEqual(parseChecked(""), { display: "", sort: "" });
});

test("splitLocation / classifyCampus", () => {
  assert.deepEqual(splitLocation("충북 충주시 대학로 50 | 없음 | 정문 옆"), { location: "충북 충주시 대학로 50", locationNotes: ["정문 옆"] });
  assert.equal(classifyCampus("충북 충주시 대소원면 대학로 50 학생회관 205호"), "in");
  assert.equal(classifyCampus("충북 충주시 대소원면 대학로 19"), "out");
  assert.equal(classifyCampus("종합강의관 1층"), "in");
  assert.equal(classifyCampus("한국교통대 충주캠퍼스 인근 대학촌 원룸가 뒷편"), "");
  assert.equal(classifyCampus("충북 충주시 호암토성4길 3 노브랜드 3층"), "out");
  assert.equal(classifyCampus(""), "");
});

test("parsePrice / priceBand: 표기된 최저 금액 기준", () => {
  assert.equal(priceBand(parsePrice("16,000원 | 22,000원").priceMin, false), "10to20");
  assert.equal(priceBand(parsePrice("4,400원").priceMin, false), "under10");
  assert.equal(priceBand(parsePrice("41,500원").priceMin, false), "over20");
  const free = parsePrice("무료");
  assert.equal(priceBand(free.priceMin, free.free), "free");
  assert.equal(priceBand(parsePrice("프린트 유료 학교 관련 서류 무료").priceMin, false), "");
});

const hm = (h, m = 0) => h * 60 + m;

test("parseHours: 요일과 시간이 명확한 경우만 해석한다", () => {
  const a = parseHours("월~토 17:00~22:00, 매주 일요일 휴무");
  assert.deepEqual(a[0], null);
  assert.deepEqual(a[1], [hm(17), hm(22)]);
  assert.deepEqual(a[6], [hm(17), hm(22)]);

  const b = parseHours("월~목 09:00~21:00 / 금 09:00~18:00");
  assert.deepEqual(b[4], [hm(9), hm(21)]);
  assert.deepEqual(b[5], [hm(9), hm(18)]);
  assert.equal(b[6], null);

  const c = parseHours("월~금 11:00~21:00 (브레이크타임 15:00~17:00, 라스트오더 20:10 / 온라인 후기 기준, 방문 전 확인 권장)");
  assert.deepEqual(c[3], [hm(11), hm(21), hm(15), hm(17)]);

  const d = parseHours("매일 11:30~21:30, 연중무휴");
  assert.ok(d.every((day) => day && day[0] === hm(11, 30)));

  const e = parseHours("월·수~일 12:00~22:00 (화요일 휴무 / 방문 전 확인 권장)");
  assert.equal(e[2], null);
  assert.deepEqual(e[1], [hm(12), hm(22)]);

  const f = parseHours("11:00~21:00 (브레이크타임 15:00~16:30, 일요일 정기휴무 / 온라인 후기 기준)");
  assert.equal(f[0], null);
  assert.deepEqual(f[2], [hm(11), hm(21), hm(15), hm(16, 30)]);

  assert.ok(parseHours("24시간").every((day) => day && day[1] === 1440));
  assert.ok(parseHours("매일 24시간.").every(Boolean));
});

test("parseHours: 애매하면 해석하지 않는다", () => {
  assert.equal(parseHours("11:00~20:00"), null); // 요일 정보 없음
  assert.equal(parseHours("확인 필요"), null);
  assert.equal(parseHours("시험기간과 그 전 1주는 24시간 연다."), null);
  assert.equal(parseHours("매일 08:30 - 20:30 19:50 라스트오더(영업안하는 날도있음)"), null);
  assert.equal(parseHours("밤에 급하면 건국대학교 충주병원 응급실(24시간, 충주시 국원대로 82)로 간다."), null);
  assert.equal(parseHours(""), null);
});

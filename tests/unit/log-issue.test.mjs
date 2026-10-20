import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendIssue, formatEntry } from "../../scripts/log-issue.mjs";

const issue = (over = {}) => ({
  ISSUE_NUMBER: "7",
  ISSUE_TITLE: "[제보] 쇼쿠스시 충주호암점",
  ISSUE_BODY: "### 장소 이름\n\n쇼쿠스시 충주호암점\n\n### 바른 정보\n\n일요일 휴무로 바뀜",
  ISSUE_USER: "tester",
  ISSUE_URL: "https://github.com/skyhy0228/campuse_place/issues/7",
  ISSUE_CREATED: "2026-10-20T10:31:00Z",
  ISSUE_LABELS: "제보",
  ...over,
});

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "issue-log-")), "이슈.txt");

test("이슈를 한국 시간으로 기록한다", () => {
  const text = formatEntry(issue());
  assert.match(text, /\[#7\] \[제보\] 쇼쿠스시 충주호암점/);
  assert.match(text, /접수: 2026-10-20 19:31 \(KST\)/);
  assert.match(text, /일요일 휴무로 바뀜/);
});

test("파일을 새로 만들고 이슈를 덧붙이며, 같은 번호는 다시 기록하지 않는다", () => {
  const file = tmpFile();
  assert.equal(appendIssue(file, issue()), true);
  assert.equal(appendIssue(file, issue({ ISSUE_NUMBER: "8", ISSUE_TITLE: "다른 제보" })), true);
  assert.equal(appendIssue(file, issue()), false);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^# 교통대 꿀팁 모음 - 접수된 이슈 기록/);
  assert.equal([...text.matchAll(/\n\[#\d+\] /g)].length, 2);
});

test("제어 문자와 긴 본문은 정리하고, 번호가 숫자가 아니면 기록하지 않는다", () => {
  const text = formatEntry(issue({ ISSUE_BODY: "a\u0000b\u0007c" + "x".repeat(10000), ISSUE_TITLE: "제목\n두 줄" }));
  assert.ok(!/[\u0000\u0007]/.test(text));
  assert.ok(text.length < 7000);
  assert.match(text, /\[#7\] 제목 두 줄/);
  assert.throws(() => appendIssue(tmpFile(), issue({ ISSUE_NUMBER: "7; rm -rf /" })));
});

test("스크립트를 직접 실행하면 ISSUE_LOG_FILE 에 기록한다", () => {
  const file = tmpFile();
  execFileSync(process.execPath, ["scripts/log-issue.mjs"], {
    env: { ...process.env, ...issue({ ISSUE_NUMBER: "21" }), ISSUE_LOG_FILE: file },
  });
  assert.match(fs.readFileSync(file, "utf8"), /\[#21\]/);
});

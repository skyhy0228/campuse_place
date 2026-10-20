// GitHub 이슈가 열리면 내용을 저장소의 이슈.txt 에 덧붙인다. (.github/workflows/issue-log.yml 에서 실행)
// 이슈 제목·본문은 신뢰할 수 없는 입력이므로 환경 변수로만 받고, 텍스트로만 기록한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEADER =
  "# 교통대 꿀팁 모음 - 접수된 이슈 기록\n# GitHub 이슈가 열릴 때마다 자동으로 덧붙여집니다. (같은 번호의 기록은 다시 추가되지 않습니다)\n";
const MAX_BODY = 6000;
const MAX_LINE = 300;

// 제어 문자와 지나치게 긴 내용을 정리한다.
const clean = (value, max) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, max);

const oneLine = (value) => clean(value, MAX_LINE).replace(/\n+/g, " ").trim();

function kst(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso ?? "");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatEntry(env) {
  const number = oneLine(env.ISSUE_NUMBER);
  const body = clean(env.ISSUE_BODY, MAX_BODY).trim() || "(내용 없음)";
  return [
    "=".repeat(60),
    `[#${number}] ${oneLine(env.ISSUE_TITLE) || "(제목 없음)"}`,
    `접수: ${kst(env.ISSUE_CREATED)} (KST)   작성자: ${oneLine(env.ISSUE_USER) || "-"}   라벨: ${oneLine(env.ISSUE_LABELS) || "-"}`,
    `링크: ${oneLine(env.ISSUE_URL)}`,
    "-".repeat(60),
    body,
    "",
  ].join("\n");
}

export function appendIssue(file, env) {
  const number = oneLine(env.ISSUE_NUMBER);
  if (!/^\d+$/.test(number)) throw new Error("이슈 번호가 올바르지 않습니다.");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : HEADER;
  if (existing.includes(`\n[#${number}] `)) return false; // 이미 기록된 이슈
  fs.writeFileSync(file, `${existing.endsWith("\n") ? existing : existing + "\n"}\n${formatEntry(env)}`, "utf8");
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.env.ISSUE_LOG_FILE || path.join(root, "이슈.txt");
  const added = appendIssue(file, process.env);
  console.log(added ? `이슈 #${process.env.ISSUE_NUMBER} 를 ${path.basename(file)} 에 기록했습니다.` : "이미 기록된 이슈입니다.");
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env.local 을 읽어 process.env 에 채운다. 이미 설정된 환경 변수는 덮어쓰지 않는다.
// 따옴표 없는 값 뒤의 '  # 주석'은 제거한다.
export function loadEnv(file = path.join(root, ".env.local")) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = value.match(/^(["'])(.*)\1/);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "").trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

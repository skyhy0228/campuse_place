// 검색 중심 첫 화면의 검색 규칙. 소주제 사전(public/data/topics.json)의 숨은 키워드로 찾고, 결과를 소주제별로 묶는다.
// 이 파일은 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit/search.test.mjs 가 Node 에서 바로 불러온다)

export interface TopicGroup {
  id: string;
  kind: "info" | "place";
  icon: string;
  ko: string;
  zh: string;
}

export interface Subtopic {
  id: string;
  group: string;
  icon: string;
  ko: string;
  zh: string;
  keywords: { ko: string[]; zh: string[] };
}

export interface TopicDict {
  groups: TopicGroup[];
  saverWords: { ko: string[]; zh: string[] };
  subtopics: Subtopic[];
}

// 검색에 필요한 값만 담은 문서. haystack 은 소문자·NFC 로 정규화돼 있어야 한다.
export interface SearchDoc {
  id: string;
  name: string;
  haystack: string;
  choseong: string;
  subtopic?: string;
  recommendations: number;
  isFood: boolean;
}

interface IndexedSubtopic {
  group: string;
  // 키워드와 소주제 이름(한·중)을 정규화해 둔 것
  words: string[];
}

export interface TopicIndex {
  get(id: string | undefined): IndexedSubtopic | undefined;
  saver: string[];
}

// 'food' = 맛집, 'etc' = 소주제가 없는 항목(학생 제보 등)
export interface ResultGroup {
  key: string;
  ids: string[];
}

export interface SearchResult {
  total: number;
  // 결과가 적으면 묶지 않고 바로 나열한다.
  flat: boolean;
  groups: ResultGroup[];
  // 묶음 순서를 따른 전체 순서
  order: string[];
}

export const FLAT_LIMIT = 5;

const SCORE = { name: 10, choseong: 8, keywordExact: 7, keywordPart: 5, text: 3, phrase: 8, saverGroup: 5, saverText: 3 };
const SAVER_TEXT = /무료|할인|싸|공짜|저렴|절약|혜택|免费|优惠|打折|便宜/;

const norm = (value: string) => value.normalize("NFC").toLowerCase().trim();
const isChoseong = (token: string) => /^[ㄱ-ㅎ]+$/.test(token);

export function buildTopicIndex(dict: TopicDict): TopicIndex {
  const map = new Map<string, IndexedSubtopic>();
  for (const s of dict.subtopics) {
    map.set(s.id, { group: s.group, words: [...s.keywords.ko, ...s.keywords.zh, s.ko, s.zh].map(norm).filter(Boolean) });
  }
  return {
    get: (id) => (id ? map.get(id) : undefined),
    saver: [...dict.saverWords.ko, ...dict.saverWords.zh].map(norm),
  };
}

// 한 단어가 문서에 얼마나 잘 맞는지. 0 이면 맞지 않는다.
function tokenScore(doc: SearchDoc, sub: IndexedSubtopic | undefined, token: string): number {
  if (isChoseong(token)) return doc.choseong.replace(/\s+/g, "").includes(token) ? SCORE.choseong : 0;
  let score = 0;
  if (norm(doc.name).includes(token)) score = SCORE.name;
  if (sub) {
    if (sub.words.includes(token)) score = Math.max(score, SCORE.keywordExact);
    // 두 글자 이상이고 키워드가 검색어로 시작할 때만 부분 일치로 본다 ('수강' → '수강신청').
    // 아무 데나 들어 있는 것까지 인정하면 '할인'이 '아이스크림 할인점' 때문에 그 소주제 전체를 끌고 온다.
    else if (token.length >= 2 && sub.words.some((w) => w.startsWith(token))) {
      score = Math.max(score, SCORE.keywordPart);
    }
  }
  if (!score && doc.haystack.includes(token)) score = SCORE.text;
  return score;
}

// 공백으로 나눈 단어가 모두 맞는 항목만 남긴다. 단, '싸게·무료' 같은 절약 신호어는 맞지 않아도 되고 대신 순위를 올린다.
export function searchDocs(docs: SearchDoc[], index: TopicIndex, query: string): SearchResult {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { total: 0, flat: true, groups: [], order: [] };
  const phrase = tokens.join(" ");
  const isSaver = (t: string) => index.saver.some((w) => t.includes(w));
  const saverTokens = tokens.filter(isSaver);
  const contentTokens = tokens.filter((t) => !isSaver(t));

  const scored: { doc: SearchDoc; score: number }[] = [];
  for (const doc of docs) {
    const sub = index.get(doc.subtopic);
    let score = 0;
    let ok = true;
    for (const token of contentTokens) {
      const s = tokenScore(doc, sub, token);
      if (!s) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;
    const saverScore = saverTokens.reduce((sum, t) => sum + tokenScore(doc, sub, t), 0);
    // 절약 신호어만 검색했다면 그중 하나는 맞아야 한다.
    if (!contentTokens.length && !saverScore) continue;
    score += saverScore;
    if (tokens.length > 1 && sub?.words.includes(phrase)) score += SCORE.phrase;
    if (saverTokens.length) {
      if (sub?.group === "money") score += SCORE.saverGroup;
      if (SAVER_TEXT.test(doc.haystack)) score += SCORE.saverText;
    }
    scored.push({ doc, score });
  }

  scored.sort(
    (a, b) => b.score - a.score || b.doc.recommendations - a.doc.recommendations || a.doc.name.localeCompare(b.doc.name, "ko"),
  );

  // 가장 잘 맞는 항목이 속한 묶음부터 나온다.
  const groups: ResultGroup[] = [];
  const byKey = new Map<string, ResultGroup>();
  for (const { doc } of scored) {
    const key = doc.subtopic ?? (doc.isFood ? "food" : "etc");
    let group = byKey.get(key);
    if (!group) {
      group = { key, ids: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.ids.push(doc.id);
  }
  return {
    total: scored.length,
    flat: scored.length <= FLAT_LIMIT,
    groups,
    order: groups.flatMap((g) => g.ids),
  };
}

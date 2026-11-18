// 소주제 사전(public/data/topics.json)을 불러와 화면에서 쓰기 좋게 정리한다. 검색 규칙 자체는 search.ts 에 있다.
import { useEffect, useState } from "react";
import type { Lang } from "./i18n";
import { assetUrl } from "./places";
import { buildTopicIndex, type Subtopic, type TopicDict, type TopicGroup, type TopicIndex } from "./search";

export interface Topics {
  dict: TopicDict;
  index: TopicIndex;
  groups: Map<string, TopicGroup>;
  subtopics: Map<string, Subtopic>;
  // 회전 칩 순서: 묶음을 번갈아 가며 하나씩 뽑아 같은 분야가 연달아 나오지 않게 한다.
  chipOrder: Subtopic[];
}

export function prepareTopics(dict: TopicDict): Topics {
  const byGroup = dict.groups.map((g) => dict.subtopics.filter((s) => s.group === g.id));
  const chipOrder: Subtopic[] = [];
  for (let i = 0; byGroup.some((list) => i < list.length); i += 1) {
    for (const list of byGroup) if (list[i]) chipOrder.push(list[i]);
  }
  return {
    dict,
    index: buildTopicIndex(dict),
    groups: new Map(dict.groups.map((g) => [g.id, g])),
    subtopics: new Map(dict.subtopics.map((s) => [s.id, s])),
    chipOrder,
  };
}

export const topicName = (item: { ko: string; zh: string }, lang: Lang) => (lang === "zh" ? item.zh : item.ko);

// 소주제 사전이 없어도 사이트는 그대로 돌아가야 한다. 실패하면 null 로 두고 예전 목록 화면을 쓴다.
export function useTopics(): Topics | null {
  const [topics, setTopics] = useState<Topics | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(assetUrl("data/topics.json"), { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<TopicDict>) : Promise.reject(new Error(String(response.status)))))
      .then((dict) => setTopics(prepareTopics(dict)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return topics;
}

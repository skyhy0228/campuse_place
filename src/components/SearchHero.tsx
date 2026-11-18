import { Lightbulb, MapPin, Search, Utensils, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "../lib/i18n";
import type { Subtopic } from "../lib/search";
import { topicName } from "../lib/topics";
import type { Entry } from "../types";
import { RotatingChips } from "./RotatingChips";

interface Props {
  query: string;
  onQuery: (query: string) => void;
  chips: Subtopic[];
  onEntry: (entry: Entry) => void;
  // 검색어가 없을 때 입구 아래에 놓는 내용 (오늘 뭐 먹지·학식·버스·장소 제보 바로 가기)
  below?: ReactNode;
  // 검색어가 있을 때 검색창 아래에 나오는 결과
  children?: ReactNode;
}

const PLACEHOLDER_MS = 3500;

// 검색 중심 첫 화면: 큰 질문 문구 + 검색창 + 회전하는 추천 주제 + 입구 3개(맛집·장소·정보).
// 검색어를 입력하면 같은 검색창이 위로 올라가고 아래에 결과가 나온다. (입력 중 초점이 끊기지 않게 같은 요소를 유지한다)
export function SearchHero({ query, onQuery, chips, onEntry, below, children }: Props) {
  const { lang, t } = useLang();
  const examples = t.heroExamples;
  const [example, setExample] = useState(0);
  const [focused, setFocused] = useState(false);
  const searching = query.trim().length > 0;

  // 검색창 안내 문구를 예시 검색어로 바꿔 가며 보여 준다. 입력 중이거나 '동작 줄이기'면 멈춘다.
  useEffect(() => {
    if (focused || query || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setExample((i) => (i + 1) % examples.length), PLACEHOLDER_MS);
    return () => window.clearInterval(timer);
  }, [focused, query, examples.length]);

  const pick = (chip: Subtopic) => onQuery(topicName(chip, lang));

  return (
    <section className={`searchHero${searching ? " searching" : ""}`} aria-labelledby="heroTitle">
      <h2 id="heroTitle" className="heroTitle">
        {t.heroTitle}
      </h2>
      <form className="heroSearch glass liquid" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="heroSearch" className="srOnly">
          {t.heroSearchLabel}
        </label>
        <Search size={20} className="searchIcon" aria-hidden="true" />
        <input
          id="heroSearch"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t.heroExamplePh(examples[example % examples.length])}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="clear" onClick={() => onQuery("")} aria-label={t.clearSearch}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </form>

      {!searching && (
        <>
          {chips.length > 0 && <RotatingChips chips={chips} onPick={pick} />}
          <nav className="entries" aria-label={t.entryGroup}>
            <button type="button" className="entry glass liquid" onClick={() => onEntry("food")}>
              <Utensils size={22} aria-hidden="true" />
              {t.entryFood}
            </button>
            <button type="button" className="entry glass liquid" onClick={() => onEntry("place")}>
              <MapPin size={22} aria-hidden="true" />
              {t.entryPlace}
            </button>
            <button type="button" className="entry glass liquid" onClick={() => onEntry("info")}>
              <Lightbulb size={22} aria-hidden="true" />
              {t.entryInfo}
            </button>
          </nav>
          {below}
        </>
      )}

      {searching && children}
    </section>
  );
}

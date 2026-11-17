import { ArrowLeft, SearchX, ThumbsUp } from "lucide-react";
import { coverFor } from "../lib/cover";
import { useLang, type Dict } from "../lib/i18n";
import { placeText, type PlaceView } from "../lib/places";
import type { SearchResult, Subtopic } from "../lib/search";
import { topicName, type Topics } from "../lib/topics";
import type { Entry } from "../types";
import { categoryIcon } from "./categoryIcon";

const scopeLabel = (place: PlaceView, t: Dict) =>
  place.scope === "in" ? t.scopeIn : place.scope === "out" ? t.scopeOut : place.scope === "both" ? t.scopeBoth : place.scope === "info" ? t.scopeInfo : "";

// 결과 한 줄: 아이콘(맛집은 작은 사진) + 제목 + 한 줄 요약 + 메타(교내·교외, 추천 수). 줄 전체를 누르면 상세가 열린다.
function ResultRow({ place, topics, onOpen }: { place: PlaceView; topics: Topics; onOpen: (id: string) => void }) {
  const { lang, t } = useLang();
  const text = placeText(place, lang);
  const sub = place.subtopic ? topics.subtopics.get(place.subtopic) : undefined;
  const cover = place.isFood ? coverFor(place, t, text.name) : null;
  const Icon = categoryIcon(place.category);
  const line = place.isFood ? text.summary || text.menu.slice(0, 3).join(", ") : text.summary || text.location;
  const scope = scopeLabel(place, t);
  return (
    <li>
      <button type="button" className="resultRow" data-category={place.category} onClick={() => onOpen(place.id)}>
        <span className="rowIcon" aria-hidden="true">
          {cover ? (
            <img src={cover.src} srcSet={cover.srcSet} sizes="48px" alt="" width={48} height={48} loading="lazy" decoding="async" />
          ) : sub ? (
            sub.icon
          ) : (
            <Icon size={22} />
          )}
        </span>
        <span className="rowText">
          <span className="rowTitle">{text.name}</span>
          {line && <span className="rowLine">{line}</span>}
          <span className="rowMeta">
            {scope && <span>{scope}</span>}
            {sub && <span>{topicName(sub, lang)}</span>}
            {place.recommendations > 0 && (
              <span className="recommend">
                <ThumbsUp size={12} aria-hidden="true" />
                <span className="srOnly">{t.recommendations} </span>
                {place.recommendations}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

interface ResultsProps {
  query: string;
  result: SearchResult;
  byId: Map<string, PlaceView>;
  topics: Topics;
  suggestions: Subtopic[];
  onOpen: (id: string) => void;
  onQuery: (query: string) => void;
}

// 검색 결과: 소주제별 묶음으로 한 화면에 보여 준다. 결과가 적으면(FLAT_LIMIT 이하) 묶음 제목 없이 바로 나열한다.
export function SearchResults({ query, result, byId, topics, suggestions, onOpen, onQuery }: ResultsProps) {
  const { lang, t } = useLang();

  if (!result.total) {
    return (
      <div className="notice empty searchEmpty">
        <SearchX size={28} aria-hidden="true" />
        <p>{t.searchEmpty(query.trim())}</p>
        <p className="detail">{t.searchEmptyHint}</p>
        <div className="chipRow center">
          {suggestions.map((s) => (
            <button key={s.id} type="button" className="chip topicChip glass liquid" onClick={() => onQuery(topicName(s, lang))}>
              <span aria-hidden="true">{s.icon}</span>
              {topicName(s, lang)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const groupTitle = (key: string) => {
    if (key === "food") return { icon: "🍽️", name: t.resultsFood };
    if (key === "etc") return { icon: "💬", name: t.resultsEtc };
    const sub = topics.subtopics.get(key);
    return sub ? { icon: sub.icon, name: topicName(sub, lang) } : { icon: "💬", name: t.resultsEtc };
  };
  const rows = (ids: string[]) =>
    ids.map((id) => {
      const place = byId.get(id);
      return place ? <ResultRow key={id} place={place} topics={topics} onOpen={onOpen} /> : null;
    });

  return (
    <div className="results">
      <p className="resultCount" role="status">
        {t.resultsCount(result.total)}
      </p>
      {result.flat ? (
        <ul className="rowList glass liquid">{rows(result.order)}</ul>
      ) : (
        result.groups.map((group) => {
          const title = groupTitle(group.key);
          return (
            <section key={group.key} className="resultGroup">
              <h3 className="groupTitle">
                <span aria-hidden="true">{title.icon}</span> {title.name} <span className="count">{group.ids.length}</span>
              </h3>
              <ul className="rowList glass liquid">{rows(group.ids)}</ul>
            </section>
          );
        })
      )}
    </div>
  );
}

interface BrowseProps {
  entry: Exclude<Entry, "" | "food">;
  places: PlaceView[];
  topics: Topics;
  onOpen: (id: string) => void;
  onBack: () => void;
}

const byRank = (a: PlaceView, b: PlaceView) => b.recommendations - a.recommendations || a.name.localeCompare(b.name, "ko");

// 입구 '장소'(교내 → 교외)와 '정보'(대분류 6개)를 소주제별 목록으로 둘러본다.
// 교내·교외 양쪽에 속하는 항목(999번 버스)은 두 곳 모두에 나온다.
export function BrowseList({ entry, places, topics, onOpen, onBack }: BrowseProps) {
  const { lang, t } = useLang();
  const kind = entry === "place" ? "place" : "info";
  const groups = topics.dict.groups.filter((g) => g.kind === kind);
  const inSection = (place: PlaceView, groupId: string) =>
    kind === "info" ? place.scope === "info" && topics.subtopics.get(place.subtopic ?? "")?.group === groupId : place.scope === groupId || place.scope === "both";

  return (
    <div className="browse">
      <button type="button" className="button small backHome" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        {t.entryBack}
      </button>
      <h2 className="listTitle">{entry === "place" ? t.entryPlace : t.entryInfo}</h2>
      {groups.map((group) => {
        const members = places.filter((p) => p.subtopic && inSection(p, group.id));
        // 이 묶음의 소주제 순서를 따르고, 다른 묶음 소주제의 항목(양쪽 표시)은 뒤에 붙인다.
        const own = topics.dict.subtopics.filter((s) => s.group === group.id).map((s) => s.id);
        const extra = [...new Set(members.map((p) => p.subtopic as string))].filter((id) => !own.includes(id));
        return (
          <section key={group.id} className="browseGroup">
            <h3 className="browseGroupTitle">
              <span aria-hidden="true">{group.icon}</span> {topicName(group, lang)}
            </h3>
            {[...own, ...extra].map((subId) => {
              const sub = topics.subtopics.get(subId);
              const items = members.filter((p) => p.subtopic === subId).sort(byRank);
              if (!sub || !items.length) return null;
              return (
                <section key={subId} className="resultGroup">
                  <h4 className="groupTitle">
                    <span aria-hidden="true">{sub.icon}</span> {topicName(sub, lang)} <span className="count">{items.length}</span>
                  </h4>
                  <ul className="rowList glass liquid">
                    {items.map((place) => (
                      <ResultRow key={place.id} place={place} topics={topics} onOpen={onOpen} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

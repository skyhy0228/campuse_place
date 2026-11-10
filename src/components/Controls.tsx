import { ListFilter, RotateCcw, Star } from "lucide-react";
import { foodPhotoUrl } from "../lib/cover";
import { useLang } from "../lib/i18n";
import type { CategoryOption } from "../lib/places";
import type { Collection } from "../lib/userData";
import type { Campus, Filters, PriceBand, SortKey, Zone } from "../types";
import { categoryIcon } from "./categoryIcon";

interface Props {
  total: number;
  visibleCount: number;
  categories: CategoryOption[];
  foodCounts: Map<string, number>;
  filters: Filters;
  patch: (change: Partial<Filters>) => void;
  onReset: () => void;
  filtersActive: boolean;
  favoriteCount: number;
  collections: Collection[];
  panelOpen: boolean;
  onTogglePanel: () => void;
  openableCount: number;
  hasZones: boolean;
  hasIntl: boolean;
}

const FOOD_CATEGORIES = ["", "식당", "카페"];

export function Controls(props: Props) {
  const { filters, patch, categories, foodCounts } = props;
  const { t } = useLang();

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "recommendations", label: t.sortRecommend },
    { value: "rating", label: t.sortRating },
    { value: "name", label: t.sortName },
    { value: "checked", label: t.sortChecked },
  ];
  const campusOptions: { value: Campus; label: string }[] = [
    { value: "", label: t.all },
    { value: "in", label: t.campusIn },
    { value: "out", label: t.campusOut },
  ];
  const priceOptions: { value: PriceBand; label: string }[] = [
    { value: "", label: t.all },
    { value: "free", label: t.priceFree },
    { value: "under10", label: t.priceUnder10 },
    { value: "10to20", label: t.price10to20 },
    { value: "over20", label: t.priceOver20 },
  ];
  const zoneOptions: { value: "" | Zone; label: string }[] = [
    { value: "", label: t.all },
    { value: "front", label: t.zoneFront },
    { value: "city", label: t.zoneCity },
    { value: "suburb", label: t.zoneSuburb },
  ];

  const foodContext = FOOD_CATEGORIES.includes(filters.category);
  // 음식 칩은 지금 조건에서 결과가 있는 종류만 보여준다. (고른 칩은 0개여도 남겨 해제할 수 있게 한다)
  const foods = Object.keys(t.foodNames).filter((key) => (foodCounts.get(key) ?? 0) > 0 || filters.food === key);
  const advancedCount = (filters.openNow ? 1 : 0) + (filters.campus ? 1 : 0) + (filters.price ? 1 : 0) + (filters.intl ? 1 : 0);

  return (
    <section className="controls" aria-label={`${t.categoryGroup} · ${t.filter} · ${t.sort}`}>
      <div className="chipRow" role="group" aria-label={t.categoryGroup}>
        <button type="button" className="chip" aria-pressed={!filters.category} onClick={() => patch({ category: "", food: "" })}>
          {t.all} <span className="count">{props.total}</span>
        </button>
        {categories.map((option) => {
          const Icon = categoryIcon(option.value);
          const pressed = filters.category === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className="chip"
              data-category={option.value}
              aria-pressed={pressed}
              onClick={() => patch({ category: pressed ? "" : option.value, food: "" })}
            >
              <span className="chipIcon" aria-hidden="true">
                <Icon size={14} />
              </span>
              {t.categoryNames[option.value] ?? option.label} <span className="count">{option.count}</span>
            </button>
          );
        })}
      </div>

      {foodContext && foods.length > 0 && (
        // PC 사이드바에서는 맛집·카페를 고르거나 음식 칩을 눌렀을 때만 펼친다. (휴대폰은 한 줄로 늘 보여준다)
        <div className={`foodBlock${filters.category || filters.food ? "" : " idle"}`}>
          <h2 className="srOnly">{t.foodTitle}</h2>
          <div className="foodChips" role="group" aria-label={t.foodGroup}>
            {foods.map((key) => (
              <button
                key={key}
                type="button"
                className="chip foodChip"
                aria-pressed={filters.food === key}
                onClick={() => patch({ food: filters.food === key ? "" : key })}
              >
                <img src={foodPhotoUrl(key, 480)} alt="" width={32} height={32} loading="lazy" decoding="async" />
                {t.foodNames[key]} <span className="count">{foodCounts.get(key) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {foodContext && props.hasZones && (
        <div className={`segmented full foodBlock${filters.category || filters.food || filters.zone ? "" : " idle"}`} role="group" aria-label={t.zoneGroup}>
          {zoneOptions.map((o) => (
            <button key={o.value} type="button" aria-pressed={filters.zone === o.value} onClick={() => patch({ zone: o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="toolRow">
        <p className="resultCount" role="status" aria-live="polite">
          {t.results} <strong>{props.visibleCount}</strong>
          {t.resultsUnit}
        </p>
        <div className="toolActions">
          <button
            type="button"
            className={`button small${filters.list === "fav" ? " active" : ""}`}
            aria-pressed={filters.list === "fav"}
            onClick={() => patch({ list: filters.list === "fav" ? "" : "fav" })}
          >
            <Star size={15} aria-hidden="true" fill={filters.list === "fav" ? "currentColor" : "none"} />
            {t.favorites} {props.favoriteCount}
          </button>
          {props.collections.length > 0 && (
            <div className="sortBox">
              <label htmlFor="list">{t.myLists}</label>
              <select id="list" value={filters.list.startsWith("c:") ? filters.list : ""} onChange={(e) => patch({ list: e.target.value })}>
                <option value="">{t.noneSelected}</option>
                {props.collections.map((c) => (
                  <option key={c.id} value={`c:${c.id}`}>
                    {c.name} ({c.placeIds.length})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            className={`button small${advancedCount ? " active" : ""}`}
            aria-expanded={props.panelOpen}
            aria-controls="filterPanel"
            onClick={props.onTogglePanel}
          >
            <ListFilter size={15} aria-hidden="true" />
            {t.filter}
            {advancedCount ? ` ${advancedCount}` : ""}
          </button>
          <div className="sortBox">
            <label htmlFor="sort">{t.sort}</label>
            <select id="sort" value={filters.sort} onChange={(event) => patch({ sort: event.target.value as SortKey })}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="button small" onClick={props.onReset} disabled={!props.filtersActive}>
            <RotateCcw size={15} aria-hidden="true" />
            {t.reset}
          </button>
        </div>
      </div>

      {props.panelOpen && (
        <div id="filterPanel" className="filterPanel" role="group" aria-label={t.extraFilters}>
          <div className="filterItem">
            <button type="button" className="chip" aria-pressed={filters.openNow} onClick={() => patch({ openNow: !filters.openNow })}>
              {t.openNow}
            </button>
            <p className="hint">{t.openNowHint(props.openableCount)}</p>
          </div>
          {props.hasIntl && (
            <div className="filterItem">
              <button type="button" className="chip" aria-pressed={filters.intl} onClick={() => patch({ intl: !filters.intl })}>
                {t.intlOnly}
              </button>
            </div>
          )}
          <fieldset className="filterItem">
            <legend>{t.locationLegend}</legend>
            <div className="segmented">
              {campusOptions.map((o) => (
                <button key={o.value} type="button" aria-pressed={filters.campus === o.value} onClick={() => patch({ campus: o.value })}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="filterItem">
            <label htmlFor="price">{t.priceLabel}</label>
            <select id="price" value={filters.price} onChange={(e) => patch({ price: e.target.value as PriceBand })}>
              {priceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
}

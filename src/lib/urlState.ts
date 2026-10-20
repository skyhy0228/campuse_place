import { DEFAULT_FILTERS, type Campus, type Filters, type PriceBand, type SortKey } from "../types";

const SORTS: SortKey[] = ["recommendations", "name", "checked"];
const CAMPUS: Campus[] = ["in", "out"];
const PRICES: PriceBand[] = ["free", "under10", "10to20", "over20"];

// 주소의 쿼리 문자열을 필터 상태로 읽는다. 알 수 없는 값은 무시한다.
export function filtersFromSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  const pick = <T extends string>(value: string | null, allowed: T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    query: (params.get("q") ?? "").slice(0, 80),
    category: params.get("cat") ?? "",
    sort: pick(params.get("sort"), SORTS, DEFAULT_FILTERS.sort),
    list: params.get("list") ?? "",
    openNow: params.get("open") === "1",
    campus: pick(params.get("campus"), CAMPUS, ""),
    price: pick(params.get("price"), PRICES, ""),
  };
}

// 기본값과 다른 항목만 담아 짧은 주소를 만든다.
export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("cat", filters.category);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.list) params.set("list", filters.list);
  if (filters.openNow) params.set("open", "1");
  if (filters.campus) params.set("campus", filters.campus);
  if (filters.price) params.set("price", filters.price);
  const text = params.toString();
  return text ? `?${text}` : "";
}

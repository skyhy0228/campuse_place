// src/lib/overrides.ts 가 브라우저에서 같은 규칙으로 운영시간·가격을 다시 해석하려고 가져오는 함수의 타입.
export function parseHours(hours: string): (number[] | null)[] | null;
export function parsePrice(price: string): { priceMin: number | null; free: boolean };
export function priceBand(priceMin: number | null, free: boolean): "" | "free" | "under10" | "10to20" | "over20";

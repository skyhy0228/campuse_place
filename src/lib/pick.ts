// '오늘 뭐 먹지' 랜덤 추천. 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit 에서 바로 불러온다)

// 최근에 뽑힌 곳은 후보가 남아 있는 한 다시 뽑지 않는다.
export function pickOne<T extends { id: string }>(pool: T[], recent: string[], random: () => number = Math.random): T | null {
  if (!pool.length) return null;
  // 후보가 적으면 최근 기록을 줄여, 마지막에 뽑힌 곳만 아니면 다시 나올 수 있게 한다.
  const avoid = new Set(recent.slice(0, Math.max(0, pool.length - 1)));
  const fresh = pool.filter((item) => !avoid.has(item.id));
  const from = fresh.length ? fresh : pool;
  const index = Math.min(from.length - 1, Math.floor(random() * from.length));
  return from[index];
}

export const MAX_RECENT_PICKS = 5;

export function rememberPick(recent: string[], id: string, max = MAX_RECENT_PICKS): string[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, max);
}

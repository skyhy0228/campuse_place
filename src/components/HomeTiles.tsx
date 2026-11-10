import { foodPhotoUrl } from "../lib/cover";
import { useLang } from "../lib/i18n";
import type { Filters } from "../types";

interface Props {
  counts: { food: number; cafe: number; pub: number };
  filters: Filters;
  patch: (change: Partial<Filters>) => void;
}

// 첫 화면의 큰 사진 타일 (교통여지도의 음식점·카페·주점 타일). 사진은 AI 예시 사진이다.
export function HomeTiles({ counts, filters, patch }: Props) {
  const { t } = useLang();
  const tiles = [
    { key: "food", photo: "cat-food", label: t.categoryNames.식당, count: counts.food, pressed: filters.category === "식당" && !filters.food, change: { category: "식당", food: "" } },
    { key: "cafe", photo: "cat-cafe", label: t.categoryNames.카페, count: counts.cafe, pressed: filters.category === "카페" && !filters.food, change: { category: "카페", food: "" } },
    { key: "pub", photo: "pub", label: t.foodNames.pub, count: counts.pub, pressed: filters.food === "pub", change: { category: "", food: "pub" } },
  ].filter((tile) => tile.count > 0);
  if (!tiles.length) return null;

  return (
    <div className="tiles" role="group" aria-label={t.categoryGroup}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className="tile"
          aria-pressed={tile.pressed}
          onClick={() => patch(tile.pressed ? { category: "", food: "" } : tile.change)}
        >
          <img src={foodPhotoUrl(tile.photo, 480)} alt="" width={480} height={480} loading="lazy" decoding="async" />
          <span className="tileName">{tile.label}</span>
          <span className="tileCount">{t.count(tile.count)}</span>
        </button>
      ))}
    </div>
  );
}

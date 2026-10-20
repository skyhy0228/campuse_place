import { ThumbsUp } from "lucide-react";
import type { PlaceView } from "../lib/places";

// 추천을 여러 번 받은 곳을 첫 화면 위쪽에 따로 보여준다.
export function PopularStrip({ places, onOpen }: { places: PlaceView[]; onOpen: (id: string) => void }) {
  if (!places.length) return null;
  return (
    <section className="popular" aria-labelledby="popularTitle">
      <h2 id="popularTitle">추천 많은 곳</h2>
      <ul className="popularList">
        {places.map((place) => (
          <li key={place.id} data-category={place.category}>
            <span className="badge">{place.categoryLabel}</span>
            <button type="button" className="popularLink" onClick={() => onOpen(place.id)}>
              {place.name}
            </button>
            <span className="recommend">
              <ThumbsUp size={13} aria-hidden="true" />
              <span className="srOnly">추천 </span>
              {place.recommendations}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

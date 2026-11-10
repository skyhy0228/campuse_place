import { Star, ThumbsUp } from "lucide-react";
import { coverFor } from "../lib/cover";
import { useLang } from "../lib/i18n";
import { placeText, type PlaceView } from "../lib/places";
import { PlaceImage } from "./PlaceImage";

// 추천을 여러 번 받은 곳을 첫 화면 위쪽에 옆으로 넘기는 카드로 보여준다. (교통여지도 '오늘의 추천' 디자인)
export function PopularStrip({ places, onOpen }: { places: PlaceView[]; onOpen: (id: string) => void }) {
  const { lang, t } = useLang();
  if (!places.length) return null;
  return (
    <section className="popular" aria-labelledby="popularTitle">
      <h2 id="popularTitle">{t.popular}</h2>
      <ul className="popularList">
        {places.map((place) => {
          const text = placeText(place, lang);
          const cover = coverFor(place, t, text.name);
          return (
            <li key={place.id} className={`glass${cover ? "" : " noPhoto"}`} data-category={place.category}>
              <div className="popularText">
                <span className="eyebrow">
                  {place.rating !== undefined && (
                    <>
                      <Star size={12} aria-hidden="true" fill="currentColor" /> {place.rating.toFixed(1)} ·{" "}
                    </>
                  )}
                  {text.category}
                </span>
                <button type="button" className="popularLink" onClick={() => onOpen(place.id)}>
                  {text.name}
                </button>
                {text.summary && <p className="popularLine">{text.summary}</p>}
                <span className="recommend">
                  <ThumbsUp size={13} aria-hidden="true" />
                  <span className="srOnly">{t.recommendations} </span>
                  {place.recommendations}
                </span>
              </div>
              {cover && <PlaceImage src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 300px, 40vw" alt={cover.alt} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

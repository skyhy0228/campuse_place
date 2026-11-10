import { Star } from "lucide-react";
import { coverFor } from "../lib/cover";
import { useLang } from "../lib/i18n";
import { placeText, type PlaceView } from "../lib/places";
import { categoryIcon } from "./categoryIcon";
import { PlaceImage } from "./PlaceImage";

// PC 에서 지도를 보는 동안 사이드바에 보여주는 짧은 목록
export function SideList({ places, onOpen }: { places: PlaceView[]; onOpen: (id: string) => void }) {
  const { lang, t } = useLang();
  return (
    <ul className="sideList" aria-label={t.results}>
      {places.map((place) => {
        const text = placeText(place, lang);
        const cover = coverFor(place, t, text.name);
        const Icon = categoryIcon(place.category);
        return (
          <li key={place.id} className="sideRow" data-category={place.category}>
            {cover ? (
              <PlaceImage className="sideThumb" src={cover.src} srcSet={cover.srcSet} sizes="52px" alt="" />
            ) : (
              <span className="sideThumb" aria-hidden="true">
                <Icon size={20} />
              </span>
            )}
            <div>
              <button type="button" className="cardLink" onClick={() => onOpen(place.id)}>
                {text.name}
              </button>
              <p className="meta">
                <span>{text.category}</span>
                {place.rating !== undefined && (
                  <span className="star">
                    <Star size={12} aria-hidden="true" fill="currentColor" />
                    {place.rating.toFixed(1)}
                  </span>
                )}
                {place.distanceKm !== undefined && place.distanceKm > 0 && <span>{place.distanceKm}km</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

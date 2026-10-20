import { Banknote, Clock, ExternalLink, MapPin, Star, ThumbsUp, Utensils } from "lucide-react";
import type { PlaceView } from "../lib/places";
import { PlaceImage } from "./PlaceImage";

interface Props {
  place: PlaceView;
  favorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PlaceCard({ place, favorite, onOpen, onToggleFavorite }: Props) {
  const menuPreview = place.menuItems.slice(0, 3).join(", ");
  const menuRest = place.menuItems.length - 3;
  const cover = place.images[0];

  return (
    <article className="card" data-category={place.category}>
      <button type="button" className="cardMain" onClick={() => onOpen(place.id)} aria-label={`${place.name} 자세히 보기`}>
        {cover && <PlaceImage className="cardImage" src={cover} alt={`${place.name} 사진`} />}
        <span className="cardHead">
          <span className="badge">{place.categoryLabel}</span>
          <span className="cardTitle">{place.name}</span>
        </span>
        {place.summary && <span className="cardSummary">{place.summary}</span>}
        <span className="cardFacts">
          {place.location && (
            <span className="fact">
              <MapPin size={14} aria-hidden="true" />
              <span>{place.location}</span>
            </span>
          )}
          {menuPreview && (
            <span className="fact">
              <Utensils size={14} aria-hidden="true" />
              <span>
                {menuPreview}
                {menuRest > 0 ? ` 외 ${menuRest}` : ""}
              </span>
            </span>
          )}
          {place.priceItems[0] && (
            <span className="fact">
              <Banknote size={14} aria-hidden="true" />
              <span>{place.priceItems[0]}</span>
            </span>
          )}
          {place.hoursItems[0] && (
            <span className="fact">
              <Clock size={14} aria-hidden="true" />
              <span>{place.hoursItems[0]}</span>
            </span>
          )}
        </span>
      </button>
      <div className="cardFoot">
        <span className="meta">
          <span className="recommend" title="추천수">
            <ThumbsUp size={14} aria-hidden="true" />
            <span className="srOnly">추천수 </span>
            {place.recommendations}
          </span>
          {place.checkedAt && <span className="checked">확인 {place.checkedAt}</span>}
        </span>
        <span className="actions">
          {place.safeMapUrl && (
            <a
              className="iconButton"
              href={place.safeMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${place.name} 네이버 지도 열기 (새 탭)`}
              title="네이버 지도"
            >
              <ExternalLink size={18} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            className={`iconButton${favorite ? " active" : ""}`}
            onClick={() => onToggleFavorite(place.id)}
            aria-pressed={favorite}
            aria-label={favorite ? `${place.name} 즐겨찾기 해제` : `${place.name} 즐겨찾기 추가`}
            title={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            <Star size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
          </button>
        </span>
      </div>
    </article>
  );
}

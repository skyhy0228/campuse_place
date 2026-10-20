import { Banknote, Clock, ExternalLink, MapPin, Star, ThumbsUp, Utensils } from "lucide-react";
import type { PlaceView } from "../lib/places";
import { PlaceImage } from "./PlaceImage";

interface Props {
  place: PlaceView;
  favorite: boolean;
  open: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PlaceCard({ place, favorite, open, onOpen, onToggleFavorite }: Props) {
  const menuPreview = place.menuItems.slice(0, 3).join(", ");
  const menuRest = place.menuItems.length - 3;
  const cover = place.images[0];
  // 맛집·카페는 메뉴와 가격을, 그 외(꿀팁·장소)는 설명을 더 보여준다.
  const showFoodFacts = place.isFood;

  return (
    <article className="card" data-category={place.category}>
      {cover && <PlaceImage className="cardImage" src={cover} alt={`${place.name} 사진`} />}
      <div className="cardBody">
        <div className="badges">
          <span className="badge">{place.categoryLabel}</span>
          {open && <span className="badge open">영업 중</span>}
          {place.isRecent && <span className="badge recent">최근 확인</span>}
        </div>
        {/* 제목 버튼이 카드 전체를 덮어 카드 어디를 눌러도 열린다. 접근 가능한 이름은 장소 이름 하나다. */}
        <h3 className="cardTitle">
          <button type="button" className="cardLink" onClick={() => onOpen(place.id)}>
            {place.name}
          </button>
        </h3>
        {place.summary && <p className={`cardSummary${showFoodFacts ? "" : " long"}`}>{place.summary}</p>}
        <div className="cardFacts">
          {place.location && (
            <p className="fact">
              <MapPin size={14} aria-hidden="true" />
              <span>{place.location}</span>
            </p>
          )}
          {showFoodFacts && menuPreview && (
            <p className="fact">
              <Utensils size={14} aria-hidden="true" />
              <span>
                {menuPreview}
                {menuRest > 0 ? ` 외 ${menuRest}` : ""}
              </span>
            </p>
          )}
          {showFoodFacts && place.priceItems[0] && (
            <p className="fact">
              <Banknote size={14} aria-hidden="true" />
              <span>{place.priceItems[0]}</span>
            </p>
          )}
          {place.hoursItems[0] && (
            <p className="fact">
              <Clock size={14} aria-hidden="true" />
              <span>{place.hoursItems[0]}</span>
            </p>
          )}
        </div>
      </div>
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

import { ExternalLink, Star, ThumbsUp } from "lucide-react";
import { coverFor } from "../lib/cover";
import { useLang } from "../lib/i18n";
import { placeText, type PlaceView } from "../lib/places";
import { categoryIcon } from "./categoryIcon";
import { PlaceImage } from "./PlaceImage";

interface Props {
  place: PlaceView;
  favorite: boolean;
  open: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  // 확인한날로 정렬할 때 카드에 날짜를 보여준다.
  showChecked?: boolean;
}

export function PlaceCard({ place, favorite, open, onOpen, onToggleFavorite, showChecked = false }: Props) {
  const { lang, t } = useLang();
  const text = placeText(place, lang);
  const cover = coverFor(place, t, text.name);
  const Icon = categoryIcon(place.category);
  // 맛집·카페는 메뉴를, 그 외(꿀팁·장소)는 설명을 더 보여준다.
  const line = place.isFood ? text.summary || text.menu.slice(0, 3).join(", ") : text.summary || text.location;

  return (
    <article className="card glass" data-category={place.category}>
      {/* 사진이 없으면 분류 색과 아이콘으로 같은 크기의 자리를 채워 카드 높이를 맞춘다. */}
      <div className="cardMedia">
        {cover ? (
          <PlaceImage className="cardImage" src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 320px, 50vw" alt={cover.alt} />
        ) : (
          <Icon size={36} aria-hidden="true" />
        )}
        <span className="badge">{text.category}</span>
      </div>
      <div className="cardBody">
        {(open || place.isRecent || place.intl) && (
          <div className="badges">
            {open && <span className="badge open">{t.openStatus}</span>}
            {place.isRecent && <span className="badge recent">{t.recent}</span>}
            {place.intl && <span className="badge intl">{t.intlOnly}</span>}
          </div>
        )}
        {/* 제목 버튼이 카드 전체를 덮어 카드 어디를 눌러도 열린다. 접근 가능한 이름은 장소 이름 하나다. */}
        <h3 className="cardTitle">
          <button type="button" className="cardLink" onClick={() => onOpen(place.id)}>
            {text.name}
          </button>
        </h3>
        {text.nameKo && (
          <p className="cardAlt" lang="ko">
            {text.nameKo}
          </p>
        )}
        {line && <p className={`cardSummary${place.isFood ? "" : " long"}`}>{line}</p>}
      </div>
      <div className="cardFoot">
        <span className="meta">
          {place.rating !== undefined && (
            <span className="star">
              <Star size={13} aria-hidden="true" fill="currentColor" />
              <span className="srOnly">{t.ratingLabel} </span>
              {place.rating.toFixed(1)}
            </span>
          )}
          {place.distanceKm !== undefined && place.distanceKm > 0 && <span>{place.distanceKm}km</span>}
          <span className="recommend" title={t.recommendations}>
            <ThumbsUp size={13} aria-hidden="true" />
            <span className="srOnly">{t.recommendations} </span>
            {place.recommendations}
          </span>
          {showChecked && place.checkedAt && <span className="checked">{t.checkedAt(place.checkedAt)}</span>}
        </span>
        <span className="actions">
          {place.safeMapUrl && (
            <a
              className="iconButton"
              href={place.safeMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.openNaver(text.name)}
              title={t.naverMap}
            >
              <ExternalLink size={18} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            className={`iconButton${favorite ? " active" : ""}`}
            onClick={() => onToggleFavorite(place.id)}
            aria-pressed={favorite}
            aria-label={favorite ? t.favRemove(text.name) : t.favAdd(text.name)}
            title={favorite ? t.favOff : t.favOn}
          >
            <Star size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
          </button>
        </span>
      </div>
    </article>
  );
}

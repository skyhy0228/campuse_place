import {
  Banknote,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Share2,
  Star,
  ThumbsUp,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PlaceView } from "../lib/places";
import { PlaceImage } from "./PlaceImage";

interface Props {
  place: PlaceView;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="row">
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export function PlaceDialog({ place, favorite, onClose, onToggleFavorite }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // 렌더 시점(autoFocus 이전)의 포커스 위치를 기억했다가 닫을 때 되돌린다.
  const opener = useRef<Element | null>(document.activeElement);
  const [copied, setCopied] = useState(false);

  // showModal은 포커스를 가두고 배경을 비활성화한다. 요소가 먼저 제거되므로 포커스 복원은 직접 한다.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modalOpen");
    const previous = opener.current;
    return () => {
      document.body.classList.remove("modalOpen");
      if (dialog.open) dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => setCopied(false), [place.id]);

  const canNativeShare = typeof navigator.share === "function";

  const share = async () => {
    const url = `${location.origin}${location.pathname}#place=${place.id}`;
    if (canNativeShare) {
      try {
        await navigator.share({ title: place.name, text: place.summary || place.name, url });
      } catch {
        // 사용자가 공유를 취소한 경우
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("링크를 복사하세요", url);
    }
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialogTitle"
      onCancel={(event) => {
        // ESC는 브라우저 기본 닫기 대신 앱 상태(주소 해시 포함)를 통해 닫는다.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialogBody" data-category={place.category}>
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <span className="badge">{place.categoryLabel}</span>
            <h2 id="dialogTitle">{place.name}</h2>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="상세 닫기" autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {place.images.length > 0 && (
          <div className={`gallery${place.images.length === 1 ? " single" : ""}`}>
            {place.images.map((src, i) => (
              <PlaceImage key={src} className="galleryImage" src={src} alt={`${place.name} 사진 ${i + 1}`} showFallback />
            ))}
          </div>
        )}

        {place.summary && <p className="dialogSummary">{place.summary}</p>}

        <dl className="rows">
          {place.location && (
            <Row icon={<MapPin size={16} aria-hidden="true" />} label="위치">
              {place.location}
            </Row>
          )}
          {place.hoursItems.length > 0 && (
            <Row icon={<Clock size={16} aria-hidden="true" />} label="운영시간">
              {place.hoursItems.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </Row>
          )}
          {place.priceItems.length > 0 && (
            <Row icon={<Banknote size={16} aria-hidden="true" />} label="가격대">
              {place.priceItems.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </Row>
          )}
          {place.menuItems.length > 0 && (
            <Row icon={<Utensils size={16} aria-hidden="true" />} label="대표메뉴">
              <ul className="chips">
                {place.menuItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Row>
          )}
          <Row icon={<ThumbsUp size={16} aria-hidden="true" />} label="추천수">
            {place.recommendations}
          </Row>
          {place.checkedAt && (
            <Row icon={<CalendarCheck size={16} aria-hidden="true" />} label="확인한날">
              {place.checkedAt}
            </Row>
          )}
        </dl>

        {place.detailItems.length > 0 && (
          <section className="detailText" aria-label="자세한 설명">
            <h3>자세한 설명</h3>
            {place.detailItems.length === 1 ? (
              <p>{place.detailItems[0]}</p>
            ) : (
              <ul>
                {place.detailItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <footer className="dialogFoot">
          {place.safeMapUrl && (
            <a className="button primary" href={place.safeMapUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              네이버 지도
            </a>
          )}
          <button
            type="button"
            className={`button${favorite ? " active" : ""}`}
            onClick={() => onToggleFavorite(place.id)}
            aria-pressed={favorite}
          >
            <Star size={16} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
            {favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          </button>
          <button type="button" className="button" onClick={share}>
            {canNativeShare ? (
              <Share2 size={16} aria-hidden="true" />
            ) : copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {canNativeShare ? "공유" : copied ? "링크 복사됨" : "링크 복사"}
          </button>
        </footer>
        <p className="srOnly" role="status" aria-live="polite">
          {copied ? "링크를 복사했습니다" : ""}
        </p>
      </div>
    </dialog>
  );
}

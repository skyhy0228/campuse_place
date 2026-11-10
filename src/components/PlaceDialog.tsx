import {
  ArrowLeft,
  Banknote,
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Flag,
  Footprints,
  Map as MapIcon,
  MapPin,
  School,
  Share2,
  Star,
  ThumbsUp,
  User,
  Utensils,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { coverFor } from "../lib/cover";
import { useLang } from "../lib/i18n";
import { isLocated, mapEnabled } from "../lib/naverMap";
import { placeText, type PlaceView } from "../lib/places";
import { reportUrl } from "../lib/report";
import { supabaseEnabled } from "../lib/supabase";
import { categoryIcon } from "./categoryIcon";
import { CollectionPicker } from "./CollectionPicker";
import { Modal } from "./Modal";
import { PlaceImage } from "./PlaceImage";
import { PlaceMiniMap } from "./PlaceMiniMap";
import { Reviews } from "./Reviews";

interface Props {
  place: PlaceView;
  favorite: boolean;
  open: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onShowMap?: (id: string) => void;
  onShowCampus?: (id: string) => void;
  onReport?: (place: PlaceView) => void;
  onRatingsChanged?: () => void;
}

type Tab = "intro" | "menu" | "info" | "reviews";

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

export function PlaceDialog({ place, favorite, open, onClose, onToggleFavorite, onShowMap, onShowCampus, onReport, onRatingsChanged }: Props) {
  const { lang, t } = useLang();
  const text = placeText(place, lang);
  const cover = coverFor(place, t, text.name);
  const [copied, setCopied] = useState("");
  const hasMenu = text.menu.length > 0 || (place.isFood && text.price.length > 0);
  const tabs: { id: Tab; label: string }[] = [
    { id: "intro", label: t.tabIntro },
    ...(hasMenu ? [{ id: "menu" as const, label: t.tabMenu }] : []),
    { id: "info", label: t.tabInfo },
    ...(supabaseEnabled ? [{ id: "reviews" as const, label: t.tabReviews }] : []),
  ];
  const [tab, setTab] = useState<Tab>("intro");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 상세를 보는 동안 탭 제목을 장소 이름으로 바꾼다.
  useEffect(() => {
    const previous = document.title;
    document.title = `${text.name} · ${previous.split(" · ").at(-1)}`;
    return () => {
      document.title = previous;
    };
  }, [text.name]);

  useEffect(() => {
    setCopied("");
    setTab("intro");
  }, [place.id]);

  const canNativeShare = typeof navigator.share === "function";
  const flash = (message: string) => {
    setCopied(message);
    window.setTimeout(() => setCopied(""), 2000);
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#place=${place.id}`;
    if (canNativeShare) {
      try {
        await navigator.share({ title: text.name, text: text.summary || text.name, url });
      } catch {
        // 사용자가 공유를 취소한 경우
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash(t.linkCopiedStatus);
    } catch {
      window.prompt(t.copyPrompt, url);
    }
  };

  const copyKoreanName = async () => {
    try {
      await navigator.clipboard.writeText(place.name);
      flash(t.koNameCopied);
    } catch {
      window.prompt(t.copyKoName, place.name);
    }
  };

  // 탭 목록: 왼쪽·오른쪽 화살표로 옮겨 다닌다.
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = tabs.findIndex((x) => x.id === tab);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const Icon = categoryIcon(place.category);
  const located = isLocated(place);
  const showZhNote = lang === "zh" && text.note && text.note !== text.summary;
  const intlTip = place.intl ? (lang === "zh" ? place.intl.zh || place.intl.ko : place.intl.ko) : "";
  const soloLabel = place.solo ? { good: t.soloGood, ok: t.soloOk, hard: t.soloHard }[place.solo] : "";
  const zoneLabel = place.zone ? { front: t.zoneFront, city: t.zoneCity, suburb: t.zoneSuburb }[place.zone] : "";
  const subLine = [zoneLabel, text.food].filter(Boolean).join(" · ");
  const teamDetail = place.review && place.review.detail && place.review.detail !== place.details ? place.review : null;

  return (
    <Modal labelledBy="dialogTitle" onClose={onClose} className="placeDialog">
      <div className="detail" data-category={place.category}>
        <div className={`hero${cover ? "" : " compact"}`}>
          <button type="button" className="iconButton backButton" onClick={onClose} aria-label={t.closeDetail} autoFocus>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          {place.images.length > 0 ? (
            // 여러 장이면 옆으로 넘긴다. 키보드로도 넘길 수 있게 포커스를 받는다.
            <div className="heroImages" tabIndex={0} role="group" aria-label={t.photoOf(text.name)}>
              {place.images.map((src, i) => (
                <PlaceImage key={src} className="heroImage galleryImage" src={src} alt={t.photoN(text.name, i + 1)} showFallback eager={i === 0} />
              ))}
            </div>
          ) : cover ? (
            <PlaceImage className="heroImage" src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 440px, 100vw" alt={cover.alt} eager />
          ) : (
            <Icon size={40} aria-hidden="true" />
          )}
          {place.images.length > 1 && <span className="heroCount">1 / {place.images.length}</span>}
        </div>

        <div className="sheet glass">
          {cover?.ai && <p className="aiNote">{t.aiPhoto}</p>}
          <div className="badges">
            <span className="badge">{text.category}</span>
            {open && <span className="badge open">{t.openStatus}</span>}
            {place.isRecent && <span className="badge recent">{t.recent}</span>}
            {place.intl && <span className="badge intl">{t.intlOnly}</span>}
            {place.source === "report" && <span className="badge">{t.reportFromMember}</span>}
          </div>
          <div className="titleRow">
            <h2 id="dialogTitle">{text.name}</h2>
          </div>
          {text.nameKo && (
            <p className="altName" lang="ko">
              {text.nameKo}
              <button type="button" className="linkButton" onClick={copyKoreanName}>
                {t.copyKoName}
              </button>
            </p>
          )}
          {lang === "zh" && !text.translated && <p className="hint">{t.noZh}</p>}
          {subLine && <p className="subLine">{subLine}</p>}

          <div className="pills">
            {place.rating !== undefined && (
              <span className="pill">
                <Star size={16} className="starIcon" aria-hidden="true" fill="currentColor" />
                <span className="srOnly">{t.ratingLabel} </span>
                {place.rating.toFixed(1)}
              </span>
            )}
            {place.distanceKm !== undefined && place.distanceKm > 0 && (
              <span className="pill">
                <Footprints size={16} aria-hidden="true" />
                {t.distance(String(place.distanceKm))}
              </span>
            )}
            <span className="pill">
              <ThumbsUp size={16} aria-hidden="true" />
              {t.recommendCount(place.recommendations)}
            </span>
          </div>

          <div className="tabs" role="tablist" aria-label={t.detailTabs} onKeyDown={onTabKey}>
            {tabs.map((x) => (
              <button
                key={x.id}
                ref={(el) => {
                  tabRefs.current[x.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${x.id}`}
                aria-selected={tab === x.id}
                aria-controls={`panel-${x.id}`}
                tabIndex={tab === x.id ? 0 : -1}
                onClick={() => setTab(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>

          {tab === "intro" && (
            <div className="tabPanel" role="tabpanel" id="panel-intro" aria-labelledby="tab-intro">
              {text.summary && <p className="quote dialogSummary">{text.summary}</p>}
              {intlTip && (
                <div className="intlBox">
                  <strong>{t.intlTip}</strong>
                  <p>{intlTip}</p>
                </div>
              )}
              {showZhNote && <p>{text.note}</p>}
              {place.detailItems.length > 0 && (
                <section className="detailText" aria-label={t.details} lang={lang === "zh" ? "ko" : undefined}>
                  <h3>{t.details}</h3>
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
              {place.reviewKeywords && place.reviewKeywords.length > 0 && (
                <section className="keywords" aria-labelledby="keywordsTitle">
                  <h3 id="keywordsTitle" className="panelTitle">
                    {t.keywords}
                  </h3>
                  <ul className="keywordList" lang="ko">
                    {place.reviewKeywords.map((k) => (
                      <li key={k.label}>
                        {k.label}
                        <span>{(k.over ? t.keywordOver : t.keywordCount)(k.count.toLocaleString("ko-KR"))}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="hint">{t.keywordsSource}</p>
                </section>
              )}
              {teamDetail && (
                <section className="teamNote" aria-labelledby="teamTitle">
                  <h3 id="teamTitle" className="panelTitle">
                    {t.teamSummary}
                  </h3>
                  <p lang="ko">{teamDetail.detail}</p>
                  <p className="hint">{t.teamSummaryNote}</p>
                </section>
              )}
            </div>
          )}

          {tab === "menu" && (
            <div className="tabPanel" role="tabpanel" id="panel-menu" aria-labelledby="tab-menu">
              {text.menu.length > 0 ? (
                <ul className="menuList">
                  {text.menu.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">{t.noMenu}</p>
              )}
              {text.price.length > 0 && (
                <dl className="rows">
                  <Row icon={<Banknote size={16} aria-hidden="true" />} label={t.price}>
                    {text.price.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </Row>
                </dl>
              )}
            </div>
          )}

          {tab === "info" && (
            <div className="tabPanel" role="tabpanel" id="panel-info" aria-labelledby="tab-info">
              <dl className="rows">
                {text.location && (
                  <Row icon={<MapPin size={16} aria-hidden="true" />} label={t.location}>
                    <div>{text.location}</div>
                    {lang === "zh" && text.location !== place.location && place.location && (
                      <div className="rowNote" lang="ko">
                        {place.location}
                      </div>
                    )}
                    {place.locationNotes.map((note) => (
                      <div key={note} className="rowNote" lang={lang === "zh" ? "ko" : undefined}>
                        {note}
                      </div>
                    ))}
                  </Row>
                )}
                {text.hours.length > 0 && (
                  <Row icon={<Clock size={16} aria-hidden="true" />} label={t.hours}>
                    {text.hours.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </Row>
                )}
                {place.closedDays && (
                  <Row icon={<CalendarX size={16} aria-hidden="true" />} label={t.closedDays}>
                    <span lang={lang === "zh" ? "ko" : undefined}>{place.closedDays}</span>
                  </Row>
                )}
                {!hasMenu && text.price.length > 0 && (
                  <Row icon={<Banknote size={16} aria-hidden="true" />} label={t.price}>
                    {text.price.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </Row>
                )}
                {!hasMenu && text.menu.length > 0 && (
                  <Row icon={<Utensils size={16} aria-hidden="true" />} label={t.menu}>
                    {text.menu.join(", ")}
                  </Row>
                )}
                {soloLabel && (
                  <Row icon={<User size={16} aria-hidden="true" />} label={t.solo}>
                    {soloLabel}
                  </Row>
                )}
                <Row icon={<ThumbsUp size={16} aria-hidden="true" />} label={t.recommendations}>
                  {place.recommendations}
                </Row>
                {place.checkedAt && (
                  <Row icon={<CalendarCheck size={16} aria-hidden="true" />} label={t.checked}>
                    {place.checkedAt}
                  </Row>
                )}
              </dl>
              {mapEnabled && located && <PlaceMiniMap place={place} />}
            </div>
          )}

          {tab === "reviews" && supabaseEnabled && (
            <div className="tabPanel" role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews">
              <Reviews placeId={place.id} baseRating={place.baseRating} onChanged={() => onRatingsChanged?.()} />
            </div>
          )}

          <div className="detailMore">
            <button
              type="button"
              className={`button${favorite ? " active" : ""}`}
              onClick={() => onToggleFavorite(place.id)}
              aria-pressed={favorite}
            >
              <Star size={16} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
              {favorite ? t.favOff : t.favOn}
            </button>
            <CollectionPicker placeId={place.id} placeName={text.name} />
            <button type="button" className="button" onClick={share}>
              {canNativeShare ? (
                <Share2 size={16} aria-hidden="true" />
              ) : copied === t.linkCopiedStatus ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {canNativeShare ? t.share : copied === t.linkCopiedStatus ? t.linkCopied : t.copyLink}
            </button>
            {onReport ? (
              <button type="button" className="button" onClick={() => onReport(place)}>
                <Flag size={16} aria-hidden="true" />
                {t.report}
              </button>
            ) : (
              <a className="button" href={reportUrl(place)} target="_blank" rel="noopener noreferrer" title={t.reportGithubTitle}>
                <Flag size={16} aria-hidden="true" />
                {t.report}
              </a>
            )}
          </div>
          <p className="srOnly" role="status" aria-live="polite">
            {copied}
          </p>
        </div>

        {(place.safeMapUrl || (onShowMap && located) || (onShowCampus && place.campusXY)) && (
          <footer className="detailActions glass">
            {onShowMap && located ? (
              <button type="button" className="button primary" onClick={() => onShowMap(place.id)}>
                <MapIcon size={16} aria-hidden="true" />
                {t.viewOnMap}
              </button>
            ) : (
              onShowCampus &&
              place.campusXY && (
                <button type="button" className="button primary" onClick={() => onShowCampus(place.id)}>
                  <School size={16} aria-hidden="true" />
                  {t.viewOnCampus}
                </button>
              )
            )}
            {place.safeMapUrl && (
              <a className="button" href={place.safeMapUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                {t.naverMap}
              </a>
            )}
          </footer>
        )}
      </div>
    </Modal>
  );
}

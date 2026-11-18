// '오늘 뭐 먹지?' 랜덤 추천. 맛집·카페 중에서 고른 조건에 맞는 곳을 하나 뽑는다.
// 최근에 뽑힌 곳은 이 기기에 기억해 두고(localStorage) 후보가 남아 있는 한 다시 뽑지 않는다.
import { Dices, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coverFor } from "../lib/cover";
import { openStatus } from "../lib/hours";
import { useLang } from "../lib/i18n";
import { pickOne, rememberPick } from "../lib/pick";
import { placeText, type PlaceView } from "../lib/places";
import type { PriceBand, Zone } from "../types";
import { categoryIcon } from "./categoryIcon";
import { Modal } from "./Modal";
import { PlaceImage } from "./PlaceImage";

type Kind = "" | "식당" | "카페";
const RECENT_KEY = "campuse:recentPicks";

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // 저장하지 못해도 이번 화면에서는 기억한다.
  }
}

interface Props {
  places: PlaceView[];
  favoriteIds: Set<string>;
  now: Date;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export function RandomPick({ places, favoriteIds, now, onOpen, onClose }: Props) {
  const { lang, t } = useLang();
  const [kind, setKind] = useState<Kind>("식당");
  const [openNow, setOpenNow] = useState(false);
  const [solo, setSolo] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [price, setPrice] = useState<PriceBand>("");
  const [zone, setZone] = useState<"" | Zone>("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const food = useMemo(() => places.filter((p) => p.isFood), [places]);
  const openable = food.filter((p) => openStatus(p.schedule, now) !== "unknown").length;
  const hasZones = food.some((p) => p.zone);
  const pool = useMemo(
    () =>
      food.filter(
        (p) =>
          (!kind || p.category === kind) &&
          (!openNow || openStatus(p.schedule, now) === "open") &&
          (!solo || p.solo === "good") &&
          (!favOnly || favoriteIds.has(p.id)) &&
          (!price || p.priceBand === price) &&
          (!zone || p.zone === zone),
      ),
    [food, kind, openNow, solo, favOnly, price, zone, favoriteIds, now],
  );

  const roll = () => {
    const next = pickOne(pool, recent);
    setPickedId(next?.id ?? null);
    if (next) {
      const updated = rememberPick(recent, next.id);
      setRecent(updated);
      writeRecent(updated);
    }
  };

  // 처음 열 때와 조건을 바꿀 때 새로 뽑는다. (영업 중 판단용 시각이 바뀌는 것만으로는 다시 뽑지 않는다)
  useEffect(roll, [kind, openNow, solo, favOnly, price, zone]);

  const picked = pool.find((p) => p.id === pickedId) ?? null;
  const text = picked ? placeText(picked, lang) : null;
  const cover = picked && text ? coverFor(picked, t, text.name) : null;
  const Icon = picked ? categoryIcon(picked.category) : Dices;
  const zoneLabel = picked?.zone ? { front: t.zoneFront, city: t.zoneCity, suburb: t.zoneSuburb }[picked.zone] : "";

  const kinds: { value: Kind; label: string }[] = [
    { value: "", label: t.pickAnyFood },
    { value: "식당", label: t.categoryNames.식당 },
    { value: "카페", label: t.categoryNames.카페 },
  ];
  const prices: { value: PriceBand; label: string }[] = [
    { value: "", label: t.all },
    { value: "under10", label: t.priceUnder10 },
    { value: "10to20", label: t.price10to20 },
    { value: "over20", label: t.priceOver20 },
  ];
  const zones: { value: "" | Zone; label: string }[] = [
    { value: "", label: t.all },
    { value: "front", label: t.zoneFront },
    { value: "city", label: t.zoneCity },
    { value: "suburb", label: t.zoneSuburb },
  ];

  return (
    <Modal labelledBy="pickTitle" onClose={onClose} className="authDialog pickDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <h2 id="pickTitle">{t.pickTitle}</h2>
            <span className="hint">{t.pickPool(pool.length)}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t.close} autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pickResult" aria-live="polite">
          {picked && text ? (
            <article className="pickCard" data-category={picked.category}>
              <div className="pickMedia">
                {cover ? <PlaceImage className="cardImage" src={cover.src} srcSet={cover.srcSet} sizes="400px" alt={cover.alt} eager /> : <Icon size={36} aria-hidden="true" />}
              </div>
              <div className="pickBody">
                {cover?.ai && <p className="aiNote">{t.aiPhoto}</p>}
                <p className="eyebrow">{t.pickResult}</p>
                <h3 lang={text.srcLang}>{text.name}</h3>
                {text.nameKo && (
                  <p className="cardAlt" lang="ko">
                    {text.nameKo}
                  </p>
                )}
                <p className="subLine">{[text.category, text.food, zoneLabel].filter(Boolean).join(" · ")}</p>
                {text.summary && (
                  <p className="cardSummary" lang={text.srcLang}>
                    {text.summary}
                  </p>
                )}
                <p className="meta">
                  {picked.rating !== undefined && (
                    <span className="star">
                      <Star size={13} aria-hidden="true" fill="currentColor" />
                      <span className="srOnly">{t.ratingLabel} </span>
                      {picked.rating.toFixed(1)}
                    </span>
                  )}
                  {openStatus(picked.schedule, now) === "open" && <span className="badge open">{t.openStatus}</span>}
                  {picked.distanceKm !== undefined && picked.distanceKm > 0 && <span>{t.distance(String(picked.distanceKm))}</span>}
                </p>
              </div>
            </article>
          ) : (
            <p className="pickEmpty">{t.pickEmpty}</p>
          )}
        </div>

        <div className="buttonRow pickActions">
          <button type="button" className="button primary" onClick={roll} disabled={!pool.length}>
            <Dices size={16} aria-hidden="true" />
            {t.pickAgain}
          </button>
          {picked && (
            <button type="button" className="button" onClick={() => onOpen(picked.id)}>
              {t.pickDetail}
            </button>
          )}
        </div>

        <fieldset className="pickFilters">
          <legend>{t.pickConditions}</legend>
          <div className="segmented full" role="group" aria-label={t.pickKind}>
            {kinds.map((o) => (
              <button key={o.value} type="button" aria-pressed={kind === o.value} onClick={() => setKind(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="chipRow wrap">
            <button type="button" className="chip" aria-pressed={openNow} onClick={() => setOpenNow((v) => !v)}>
              {t.openNow}
            </button>
            <button type="button" className="chip" aria-pressed={solo} onClick={() => setSolo((v) => !v)}>
              {t.pickSolo}
            </button>
            <button type="button" className="chip" aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
              {t.pickFav}
            </button>
          </div>
          {openNow && <p className="hint">{t.openNowHint(openable)}</p>}
          <div className="field">
            <label htmlFor="pick-price">{t.priceLabel}</label>
            <select id="pick-price" value={price} onChange={(e) => setPrice(e.target.value as PriceBand)}>
              {prices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {hasZones && (
            <div className="segmented full" role="group" aria-label={t.zoneGroup}>
              {zones.map((o) => (
                <button key={o.value} type="button" aria-pressed={zone === o.value} onClick={() => setZone(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}

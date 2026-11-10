import { House, Map as MapIcon, School, Star, UserRound } from "lucide-react";
import { useLang } from "../lib/i18n";
import type { View } from "../lib/urlState";

interface Props {
  view: View;
  canShowMap: boolean;
  favoritesOn: boolean;
  onView: (view: View) => void;
  onFavorites: () => void;
  onAccount: () => void;
  accountLabel: string;
}

// 휴대폰·태블릿 하단 탭바. 가운데 둥근 버튼은 캠퍼스 지도(키 없이 항상 쓸 수 있다).
export function TabBar({ view, canShowMap, favoritesOn, onView, onFavorites, onAccount, accountLabel }: Props) {
  const { t } = useLang();
  const current = (v: View) => (view === v ? ("page" as const) : undefined);
  return (
    <nav className="tabbar glass" aria-label={t.navLabel}>
      <button type="button" className="tab" aria-current={view === "list" && !favoritesOn ? "page" : undefined} onClick={() => onView("list")}>
        <House size={22} aria-hidden="true" />
        {t.navHome}
      </button>
      {canShowMap && (
        <button type="button" className="tab" aria-current={current("map")} onClick={() => onView("map")}>
          <MapIcon size={22} aria-hidden="true" />
          {t.navMap}
        </button>
      )}
      <button type="button" className="tab orbTab" aria-current={current("campus")} onClick={() => onView("campus")}>
        <span className="orb" aria-hidden="true">
          <School size={24} />
        </span>
        {t.navCampus}
      </button>
      <button type="button" className="tab" aria-pressed={favoritesOn} onClick={onFavorites}>
        <Star size={22} aria-hidden="true" fill={favoritesOn ? "currentColor" : "none"} />
        {t.favorites}
      </button>
      <button type="button" className="tab" onClick={onAccount} title={accountLabel}>
        <UserRound size={22} aria-hidden="true" />
        {t.navMe}
      </button>
    </nav>
  );
}

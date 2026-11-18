// 이번 주 학식 메뉴 (운영자가 관리자 화면에서 입력한 것). 오늘을 먼저 보여주고 요일을 바꿔 볼 수 있다.
import { X } from "lucide-react";
import { useState } from "react";
import { weekDays, weekdayOf } from "../lib/dates";
import { useLang } from "../lib/i18n";
import { MEALS, type CafeteriaMenu } from "../lib/remote";
import { Modal } from "./Modal";

interface Props {
  menus: CafeteriaMenu[];
  today: string;
  onClose: () => void;
  onManage?: () => void;
}

export const menuItems = (items: string) =>
  items
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

export function CafeteriaDialog({ menus, today, onClose, onManage }: Props) {
  const { t } = useLang();
  const days = weekDays(today);
  const [day, setDay] = useState(today);
  const forDay = menus.filter((m) => m.served_on === day);
  const cafeterias = [...new Set(forDay.map((m) => m.cafeteria))];
  const dayLabel = (d: string) => `${t.weekdays[weekdayOf(d)]} ${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  return (
    <Modal labelledBy="cafeteriaTitle" onClose={onClose} className="infoDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <h2 id="cafeteriaTitle">{t.cafeteriaTitle}</h2>
            <span className="hint">{t.cafeteriaNote}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t.close} autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="dayRow" role="group" aria-label={t.cafeteriaDays}>
          {days.map((d) => {
            const has = menus.some((m) => m.served_on === d);
            return (
              <button key={d} type="button" className={`dayButton${has ? "" : " empty"}`} aria-pressed={day === d} onClick={() => setDay(d)}>
                <span>{d === today ? t.today : t.weekdays[weekdayOf(d)]}</span>
                <small>
                  {Number(d.slice(5, 7))}/{Number(d.slice(8, 10))}
                </small>
              </button>
            );
          })}
        </div>

        <h3 className="srOnly">{dayLabel(day)}</h3>
        {menus.length === 0 ? (
          <p className="emptyNote">{t.cafeteriaEmpty}</p>
        ) : cafeterias.length === 0 ? (
          <p className="emptyNote">{t.cafeteriaEmptyDay}</p>
        ) : (
          <div className="menuBoard">
            {cafeterias.map((name) => (
              <section key={name} className="menuPlace" aria-label={name}>
                <h4 lang="ko">{name}</h4>
                <div className="mealGrid">
                  {MEALS.map((meal) => {
                    const item = forDay.find((m) => m.cafeteria === name && m.meal === meal);
                    if (!item) return null;
                    return (
                      <div key={meal} className="mealCard">
                        <h5>{t.mealNames[meal]}</h5>
                        <ul className="mealItems" lang="ko">
                          {menuItems(item.items).map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                        {(item.price || item.note) && (
                          <p className="hint" lang="ko">
                            {[item.price, item.note].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {onManage && (
          <button type="button" className="linkButton" onClick={onManage}>
            {t.quickManage}
          </button>
        )}
      </div>
    </Modal>
  );
}

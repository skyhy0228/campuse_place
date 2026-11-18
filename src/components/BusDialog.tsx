// 버스 시간표 (운영자가 관리자 화면에서 입력한 것). 오늘 운행하는 노선의 다음 출발 시각을 먼저 보여준다.
import { X } from "lucide-react";
import { minutesUntil, runsOn, toMinutes, upcoming } from "../lib/bus";
import { kstDateString } from "../lib/dates";
import { kstNow } from "../lib/hours";
import { useLang } from "../lib/i18n";
import type { BusTime } from "../lib/remote";
import { Modal } from "./Modal";

interface Props {
  buses: BusTime[];
  now: Date;
  onClose: () => void;
  onManage?: () => void;
}

// 다음 버스 한 줄 요약 (첫 화면 바로 가기에 쓴다)
export function nextBusSummary(buses: BusTime[], now: Date): { line: string; time: string } | null {
  const { day, minutes } = kstNow(now);
  let best: { line: string; time: string; wait: number } | null = null;
  for (const bus of buses) {
    if (!runsOn(bus.day_type, day)) continue;
    const [time] = upcoming([...bus.times].sort(), minutes, 1);
    if (!time) continue;
    const wait = minutesUntil(time, minutes);
    if (!best || wait < best.wait) best = { line: bus.line, time, wait };
  }
  return best ? { line: best.line, time: best.time } : null;
}

function BusRow({ bus, minutes, today }: { bus: BusTime; minutes: number | null; today: boolean }) {
  const { t } = useLang();
  const times = [...bus.times].sort();
  const next = minutes === null ? [] : upcoming(times, minutes, 3);
  return (
    <li className="busRow">
      <div className="busHead">
        <strong lang="ko">{bus.stop}</strong>
        {bus.direction && (
          <span className="hint" lang="ko">
            → {bus.direction}
          </span>
        )}
        <span className="badge">{t.dayTypes[bus.day_type]}</span>
      </div>
      {today && (
        <div className="busNext" aria-label={t.busNext}>
          {next.length ? (
            next.map((time, i) => (
              <span key={time} className={`busTime${i === 0 ? " first" : ""}`}>
                {time}
                {i === 0 && minutes !== null && <small>{t.busIn(minutesUntil(time, minutes))}</small>}
              </span>
            ))
          ) : (
            <span className="hint">{t.busDone}</span>
          )}
        </div>
      )}
      <details className="busAll">
        <summary>
          {t.busAll} ({times.length})
        </summary>
        <ul className="busTimes">
          {times.map((time) => (
            <li key={time} className={minutes !== null && today && toMinutes(time) < minutes ? "past" : undefined}>
              {time}
            </li>
          ))}
        </ul>
      </details>
      {(bus.note || bus.source || bus.updated_at) && (
        <p className="hint" lang="ko">
          {[bus.note, bus.source ? t.busSource(bus.source) : "", bus.updated_at ? t.busUpdated(kstDateString(new Date(bus.updated_at))) : ""].filter(Boolean).join(" · ")}
        </p>
      )}
    </li>
  );
}

export function BusDialog({ buses, now, onClose, onManage }: Props) {
  const { t } = useLang();
  const { day, minutes } = kstNow(now);
  const running = buses.filter((b) => runsOn(b.day_type, day));
  const other = buses.filter((b) => !runsOn(b.day_type, day));
  const lines = [...new Set(running.map((b) => b.line))];

  return (
    <Modal labelledBy="busTitle" onClose={onClose} className="infoDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <h2 id="busTitle">{t.busTitle}</h2>
            <span className="hint">{t.busNote}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t.close} autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {buses.length === 0 && <p className="emptyNote">{t.busEmpty}</p>}

        {lines.map((line, i) => (
          <section key={line} className="busLine" aria-labelledby={`busLine-${i}`}>
            <h3 id={`busLine-${i}`} lang="ko">
              {line}
            </h3>
            <ul className="busRows">
              {running
                .filter((b) => b.line === line)
                .map((bus) => (
                  <BusRow key={bus.id} bus={bus} minutes={minutes} today />
                ))}
            </ul>
          </section>
        ))}

        {other.length > 0 && (
          <details className="busOther">
            <summary>
              {t.busOther} ({other.length})
            </summary>
            <ul className="busRows">
              {other.map((bus) => (
                <li key={bus.id} className="busOtherItem">
                  <h3 lang="ko">{bus.line}</h3>
                  <ul>
                    <BusRow bus={bus} minutes={null} today={false} />
                  </ul>
                </li>
              ))}
            </ul>
          </details>
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

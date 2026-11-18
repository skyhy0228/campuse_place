import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import type { Subtopic } from "../lib/search";
import { topicName } from "../lib/topics";

interface Props {
  chips: Subtopic[];
  onPick: (subtopic: Subtopic) => void;
}

const PAGE_SIZE = 4;
const INTERVAL_MS = 5000;
const LEAVE_MS = 280;

// 첫 화면의 추천 주제 칩. 4개 묶음을 5초마다 위로 올려 보내고 다음 묶음을 띄운다.
// - 마우스를 올리거나, 터치하거나, 키보드 초점이 들어오면 멈춘다 (누르려는 순간 바뀌지 않게).
// - ⏸ 버튼으로 계속 멈춰 둘 수 있다 (WCAG 2.2.2 멈춤·정지·숨김).
// - '동작 줄이기' 설정이면 처음부터 넘기지 않는다.
// - 화면 낭독기가 바뀔 때마다 읽지 않도록 aria-live 를 두지 않는다.
export function RotatingChips({ chips, onPick }: Props) {
  const { lang, t } = useLang();
  const [page, setPage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduce, setReduce] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const pages = Math.max(1, Math.ceil(chips.length / PAGE_SIZE));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused || held || reduce || pages < 2) return;
    let leaveTimer = 0;
    const timer = window.setInterval(() => {
      setLeaving(true);
      leaveTimer = window.setTimeout(() => {
        setPage((p) => (p + 1) % pages);
        setLeaving(false);
      }, LEAVE_MS);
    }, INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(leaveTimer);
      setLeaving(false);
    };
  }, [paused, held, reduce, pages]);

  const visible = chips.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rotating = !reduce && pages > 1;

  return (
    <div
      className="heroChips"
      role="group"
      aria-label={t.heroChips}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerDown={() => setHeld(true)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <ul key={page} className={`chipPage${leaving ? " leaving" : ""}`}>
        {visible.map((chip) => (
          <li key={chip.id}>
            <button type="button" className="chip topicChip glass liquid" onClick={() => onPick(chip)}>
              <span aria-hidden="true">{chip.icon}</span>
              {topicName(chip, lang)}
            </button>
          </li>
        ))}
      </ul>
      {rotating && (
        <button
          type="button"
          className="iconButton chipPause"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? t.heroPlay : t.heroPause}
          title={paused ? t.heroPlay : t.heroPause}
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

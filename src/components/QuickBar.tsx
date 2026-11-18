import { Bus, Dices, MapPinPlus, Soup } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "../lib/i18n";

interface Props {
  onPick: () => void;
  onAddPlace: () => void;
  // 학식·버스는 Supabase 를 쓰고, 입력된 내용이 있거나 운영자일 때만 보여준다.
  onCafeteria?: () => void;
  onBus?: () => void;
  cafeteriaHint?: string;
  busHint?: string;
}

function Item({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="quickItem glass liquid" onClick={onClick}>
        <span className="quickIcon" aria-hidden="true">
          {icon}
        </span>
        <span className="quickText">
          <strong>{title}</strong>
          {hint && <span className="quickHint">{hint}</span>}
        </span>
      </button>
    </li>
  );
}

// 첫 화면의 바로 가기: 오늘 뭐 먹지, 오늘의 학식, 다음 버스, 장소 제보
export function QuickBar({ onPick, onAddPlace, onCafeteria, onBus, cafeteriaHint, busHint }: Props) {
  const { t } = useLang();
  return (
    <nav className="quickBar" aria-label={t.quickLabel}>
      <ul>
        <Item icon={<Dices size={20} />} title={t.pickOpen} onClick={onPick} />
        {onCafeteria && <Item icon={<Soup size={20} />} title={t.cafeteriaOpen} hint={cafeteriaHint} onClick={onCafeteria} />}
        {onBus && <Item icon={<Bus size={20} />} title={t.busOpen} hint={busHint} onClick={onBus} />}
        <Item icon={<MapPinPlus size={20} />} title={t.addPlace} onClick={onAddPlace} />
      </ul>
    </nav>
  );
}

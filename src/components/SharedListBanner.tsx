// 공유 링크로 들어온 목록을 보고 있을 때 위쪽에 보여주는 안내. 로그인했으면 내 목록으로 저장할 수 있다.
import { FolderPlus, X } from "lucide-react";
import { useState } from "react";
import { useLang } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { SharedList } from "../lib/shareList";

interface Props {
  list: SharedList;
  // 지금 사이트에 있는 장소 수 (삭제된 장소는 빠진다)
  found: number;
  onClose: () => void;
}

export function SharedListBanner({ list, found, onClose }: Props) {
  const { t } = useLang();
  const s = useSession();
  const [message, setMessage] = useState("");
  const name = list.name || t.sharedTitle;
  const missing = list.ids.length - found;

  const save = () => {
    if (!s.user) {
      s.openAuth("login");
      return;
    }
    setMessage(s.saveCollection(name, list.ids) ? t.sharedSaved : t.sharedSaveFail);
  };

  return (
    <section className="sharedBanner glass" aria-labelledby="sharedTitle">
      <div className="sharedText">
        <span className="eyebrow">{t.sharedTitle}</span>
        <h2 id="sharedTitle">
          {name} <span className="count">{t.sharedCount(found)}</span>
        </h2>
        {missing > 0 && <p className="hint">{t.sharedMissing(missing)}</p>}
        {message && (
          <p className="hint" role="status">
            {message}
          </p>
        )}
      </div>
      <div className="buttonRow">
        <button type="button" className="button small" onClick={save}>
          <FolderPlus size={15} aria-hidden="true" />
          {s.user ? t.sharedSave : t.sharedLogin}
        </button>
        <button type="button" className="iconButton" onClick={onClose} aria-label={t.sharedClose} title={t.sharedClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

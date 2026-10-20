import { FolderPlus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MAX_COLLECTIONS, MAX_COLLECTION_NAME } from "../lib/userData";
import { useSession } from "../lib/session";

// 장소를 즐겨찾기나 내 목록에 담고 빼는 체크 목록. 로그인하지 않았으면 로그인 화면으로 안내한다.
export function CollectionPicker({ placeId, placeName }: { placeId: string; placeName: string }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!s.user) {
    return (
      <button type="button" className="button" onClick={() => s.openAuth("login")}>
        <FolderPlus size={16} aria-hidden="true" />
        내 목록에 담기
      </button>
    );
  }

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (s.createCollection(name, placeId)) setName("");
  };

  return (
    <>
      <button type="button" className="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="collectionPanel">
        <FolderPlus size={16} aria-hidden="true" />
        내 목록에 담기
      </button>
      {open && (
        <div id="collectionPanel" className="collectionPanel" role="group" aria-label={`${placeName}을(를) 담을 목록`}>
          <label className="check">
            <input type="checkbox" checked={s.favoriteIds.has(placeId)} onChange={() => s.toggleFavorite(placeId)} />
            즐겨찾기
          </label>
          {s.collections.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={c.placeIds.includes(placeId)} onChange={() => s.toggleInCollection(c.id, placeId)} />
              {c.name}
            </label>
          ))}
          <form className="inlineForm" onSubmit={add}>
            <label className="srOnly" htmlFor="picker-new">
              새 목록 이름
            </label>
            <input id="picker-new" value={name} onChange={(e) => setName(e.target.value)} placeholder="새 목록 만들고 담기" maxLength={MAX_COLLECTION_NAME} />
            <button type="submit" className="button small" disabled={!name.trim() || s.collections.length >= MAX_COLLECTIONS}>
              <Plus size={15} aria-hidden="true" />
              추가
            </button>
          </form>
        </div>
      )}
    </>
  );
}

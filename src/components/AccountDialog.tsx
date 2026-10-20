import { Download, LogOut, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { MAX_COLLECTIONS, MAX_COLLECTION_NAME } from "../lib/userData";
import { useSession } from "../lib/session";
import { Modal } from "./Modal";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");

export function AccountDialog() {
  const s = useSession();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!s.accountOpen || !s.user) return null;

  const addCollection = (event: FormEvent) => {
    event.preventDefault();
    if (s.createCollection(newName)) setNewName("");
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ app: "campuse-place", version: 1, ...s.exportData() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `교통대-꿀팁-내-목록-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("파일이 너무 큽니다.");
      const result = s.importData(JSON.parse(await file.text()));
      setMessage(`가져왔습니다. 즐겨찾기 ${result.favorites}곳, 목록 ${result.collections}개를 합쳤습니다.`);
    } catch (e) {
      setMessage(e instanceof SyntaxError ? "올바른 파일이 아닙니다." : messageOf(e));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await s.removeAccount(password);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <Modal labelledBy="accountTitle" onClose={s.closeAccount} className="authDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <span className="hint">내 계정</span>
            <h2 id="accountTitle">{s.user.username}</h2>
          </div>
          <button type="button" className="iconButton" onClick={s.closeAccount} aria-label="닫기" autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <section className="accountSection" aria-labelledby="listsTitle">
          <h3 id="listsTitle">내 목록</h3>
          <p className="hint">장소 상세 화면의 &lsquo;내 목록에 담기&rsquo;로 원하는 곳을 모아두고, 메인 화면에서 목록별로 볼 수 있습니다.</p>
          <ul className="collectionList">
            <li>
              <span>즐겨찾기</span>
              <span className="count">{s.favoriteIds.size}곳</span>
            </li>
            {s.collections.map((c) => (
              <li key={c.id}>
                {editingId === c.id ? (
                  <form
                    className="inlineForm"
                    onSubmit={(e) => {
                      e.preventDefault();
                      s.renameCollection(c.id, editName);
                      setEditingId(null);
                    }}
                  >
                    <label className="srOnly" htmlFor={`rename-${c.id}`}>
                      목록 이름
                    </label>
                    <input id={`rename-${c.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={MAX_COLLECTION_NAME} autoFocus required />
                    <button type="submit" className="button small">
                      저장
                    </button>
                  </form>
                ) : (
                  <>
                    <span>{c.name}</span>
                    <span className="count">{c.placeIds.length}곳</span>
                    <span className="actions">
                      <button type="button" className="iconButton" aria-label={`${c.name} 이름 변경`} onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="iconButton"
                        aria-label={`${c.name} 삭제`}
                        onClick={() => window.confirm(`'${c.name}' 목록을 삭제할까요? (장소 자체는 삭제되지 않습니다)`) && s.deleteCollection(c.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form className="inlineForm" onSubmit={addCollection}>
            <label className="srOnly" htmlFor="new-collection">
              새 목록 이름
            </label>
            <input id="new-collection" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 목록 이름 (예: 점심 후보)" maxLength={MAX_COLLECTION_NAME} />
            <button type="submit" className="button small" disabled={!newName.trim() || s.collections.length >= MAX_COLLECTIONS}>
              <Plus size={15} aria-hidden="true" />
              추가
            </button>
          </form>
        </section>

        <section className="accountSection" aria-labelledby="dataTitle">
          <h3 id="dataTitle">데이터 옮기기</h3>
          <p className="hint">계정은 이 브라우저에만 있습니다. 다른 기기에서 쓰려면 파일로 내보낸 뒤 그 기기에서 같은 이름의 계정을 만들고 가져오세요.</p>
          <div className="buttonRow">
            <button type="button" className="button small" onClick={exportFile}>
              <Download size={15} aria-hidden="true" />
              내보내기
            </button>
            <button type="button" className="button small" onClick={() => fileRef.current?.click()}>
              <Upload size={15} aria-hidden="true" />
              가져오기
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} aria-label="가져올 파일 선택" />
            {s.guestFavoriteCount > 0 && (
              <button type="button" className="button small" onClick={() => setMessage(`이 기기의 즐겨찾기 ${s.importGuestFavorites()}곳을 가져왔습니다.`)}>
                로그인 전 즐겨찾기 {s.guestFavoriteCount}곳 가져오기
              </button>
            )}
          </div>
          {message && (
            <p className="formNotice" role="status">
              {message}
            </p>
          )}
        </section>

        <section className="accountSection">
          <div className="buttonRow">
            <button type="button" className="button" onClick={s.logout}>
              <LogOut size={16} aria-hidden="true" />
              로그아웃
            </button>
            <button type="button" className="button danger" onClick={() => setDeleting((v) => !v)} aria-expanded={deleting}>
              <Trash2 size={16} aria-hidden="true" />
              계정 삭제
            </button>
          </div>
          {deleting && (
            <form className="authForm" onSubmit={removeAccount}>
              <p className="hint">계정과 내 목록이 이 브라우저에서 영구히 삭제됩니다. 비밀번호를 입력해 확인하세요.</p>
              <label htmlFor="delete-password" className="srOnly">
                비밀번호
              </label>
              <input id="delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" autoComplete="current-password" required />
              {error && (
                <p className="formError" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button danger">
                삭제하기
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}

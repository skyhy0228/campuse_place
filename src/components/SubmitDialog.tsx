// 새 장소·꿀팁 제보와 정보 수정 제보 (Supabase). 운영자가 관리자 화면에서 승인한 새 장소만 사이트에 보인다.
import { ImagePlus, LocateFixed, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "../lib/i18n";
import { CONTACT, shrinkPhoto } from "../lib/photo";
import { isNaverMapUrl } from "../lib/places";
import { createSubmission, uploadPhoto, type SubmissionKind } from "../lib/remote";
import { useSession } from "../lib/session";
import { Modal } from "./Modal";

export interface SubmitTarget {
  kind: SubmissionKind;
  placeId?: string;
  name?: string;
  category?: string;
}

const CATEGORIES = ["식당", "카페", "학교시설", "숨은장소", "생활꿀팁", "관광지", "자유"];
const COOLDOWN_KEY = "campuse:lastSubmit";
const COOLDOWN_MS = 60_000;
const MAX_PHOTOS = 3;

interface Photo {
  blob: Blob;
  url: string;
}

export function SubmitDialog({ target, onClose }: { target: SubmitTarget; onClose: () => void }) {
  const { t } = useLang();
  const s = useSession();
  const fix = target.kind === "fix";
  const [name, setName] = useState(target.name ?? "");
  // 정보 수정 제보는 장소의 분류를 그대로 보낸다. (서버가 받는 분류가 아니면 '자유')
  const [category, setCategory] = useState(target.category && CATEGORIES.includes(target.category) ? target.category : fix ? "자유" : "식당");
  const [location, setLocation] = useState("");
  const [body, setBody] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const minBody = fix ? 10 : 20;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next = [...photos];
    for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
      try {
        const blob = await shrinkPhoto(file);
        next.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        setError(t.submitPhotoError);
      }
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const locate = () => {
    setError("");
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoord({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 }),
      () => setError(t.submitLocateFail),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!s.user) return;
    // 사람에게는 보이지 않는 칸이 채워져 있으면 자동 프로그램으로 보고 조용히 끝낸다.
    if (honeypot) {
      setDone(true);
      return;
    }
    if ([name, location, body].some((v) => CONTACT.test(v))) {
      setError(t.submitContact);
      return;
    }
    if (mapUrl && !isNaverMapUrl(mapUrl.trim())) {
      setError(t.submitMapUrlHint);
      return;
    }
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) {
      setError(t.submitTooFast);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const paths: string[] = [];
      for (const photo of photos) paths.push(await uploadPhoto(s.user.id, photo.blob));
      await createSubmission({
        kind: target.kind,
        place_id: target.placeId,
        name: name.trim(),
        category,
        location: location.trim() || undefined,
        body: body.trim(),
        map_url: mapUrl.trim() || undefined,
        lat: coord?.lat,
        lng: coord?.lng,
        photos: paths,
      });
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal labelledBy="submitTitle" onClose={onClose} className="authDialog">
      <div className="dialogBody">
        <header className="dialogHead">
          <div className="dialogTitleWrap">
            <h2 id="submitTitle">{fix ? t.submitTitleFix : t.submitTitleNew}</h2>
            {fix && target.name && <span className="hint">{target.name}</span>}
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label={t.close} autoFocus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {done ? (
          <p className="formNotice" role="status">
            {t.submitDone}
          </p>
        ) : !s.user ? (
          <div className="authForm">
            <p>{t.submitLogin}</p>
            <button type="button" className="button primary" onClick={() => s.openAuth("login")}>
              {t.login}
            </button>
          </div>
        ) : (
          <form className="authForm" onSubmit={submit}>
            <p className="hint">{t.submitLead}</p>
            {!fix && (
              <>
                <div className="field">
                  <label htmlFor="submit-name">{t.submitName}</label>
                  <input id="submit-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
                </div>
                <div className="field">
                  <label htmlFor="submit-category">{t.submitCategory}</label>
                  <select id="submit-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t.categoryNames[c] ?? c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="submit-location">{t.submitLocation}</label>
                  <input id="submit-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="submit-body">{fix ? t.submitBodyFix : t.submitBody(minBody)}</label>
              <textarea id="submit-body" value={body} onChange={(e) => setBody(e.target.value)} minLength={minBody} maxLength={500} rows={5} required />
              <p className="hint">{body.trim().length}/500</p>
            </div>
            {!fix && (
              <>
                <div className="field">
                  <label htmlFor="submit-map">{t.submitMapUrl}</label>
                  <input id="submit-map" type="url" inputMode="url" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://naver.me/…" aria-describedby="submit-map-hint" />
                  <p className="hint" id="submit-map-hint">
                    {t.submitMapUrlHint}
                  </p>
                </div>
                <div className="buttonRow">
                  {coord ? (
                    <>
                      <span className="hint">{t.submitLocated(coord.lat.toFixed(5), coord.lng.toFixed(5))}</span>
                      <button type="button" className="linkButton" onClick={() => setCoord(null)}>
                        {t.submitClearLocation}
                      </button>
                    </>
                  ) : (
                    "geolocation" in navigator && (
                      <button type="button" className="button small" onClick={locate}>
                        <LocateFixed size={15} aria-hidden="true" />
                        {t.submitLocate}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
            <div className="field">
              <span className="hint">{t.submitPhotos}</span>
              <div className="photoRow">
                {photos.map((photo, i) => (
                  <div key={photo.url} className="photoThumb">
                    <img src={photo.url} alt="" />
                    <button
                      type="button"
                      className="iconButton"
                      aria-label={t.submitRemovePhoto(i + 1)}
                      onClick={() => setPhotos((list) => list.filter((p) => p !== photo))}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" className="button small" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={15} aria-hidden="true" />
                    {t.submitAddPhoto}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} aria-label={t.submitAddPhoto} />
            </div>
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="submit-website">website</label>
              <input id="submit-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            {error && (
              <p className="formError" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button primary" disabled={busy || s.suspended}>
              {busy ? t.submitSending : t.submitSend}
            </button>
            {s.suspended && <p className="hint">{t.reviewsSuspended}</p>}
          </form>
        )}
      </div>
    </Modal>
  );
}

// 별점과 한줄 후기 (Supabase). 교통여지도 member.js 의 흐름을 옮기고, 본인 후기는 닉네임이 아니라 회원 id 로 판별한다.
import { Flag, Star } from "lucide-react";
import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { useLang } from "../lib/i18n";
import { MIN_RATERS } from "../lib/places";
import { deleteReview, listReviews, reportReview, reviewScore, saveReview, type Review } from "../lib/remote";
import { useSession } from "../lib/session";

interface Props {
  placeId: string;
  baseRating?: number;
  onChanged: () => void;
}

export function Reviews({ placeId, baseRating, onChanged }: Props) {
  const { t } = useLang();
  const s = useSession();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = s.user?.id;

  const load = useCallback(async () => {
    try {
      const rows = await listReviews(placeId, Boolean(uid));
      setReviews(rows);
      setLoadError("");
      const mine = uid ? rows.find((r) => r.user_id === uid) : undefined;
      setRating(mine?.rating ?? 0);
      setBody(mine?.body ?? "");
    } catch {
      setLoadError(t.reviewsError);
    }
  }, [placeId, uid, t.reviewsError]);

  useEffect(() => {
    setReviews(null);
    setMessage("");
    void load();
  }, [load]);

  const mine = uid ? reviews?.find((r) => r.user_id === uid) : undefined;
  const raters = (reviews?.length ?? 0) + (baseRating ? 1 : 0);
  const score = reviews ? reviewScore(baseRating, reviews) : baseRating;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating) {
      setMessage(t.reviewsNeedRating);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await saveReview(placeId, rating, body.trim());
      await load();
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteReview(placeId);
      await load();
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const report = async (review: Review) => {
    if (!s.user) {
      s.openAuth("login");
      return;
    }
    if (!window.confirm(t.reviewsReportConfirm)) return;
    try {
      await reportReview(review.id);
      setMessage(t.reviewsReported);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="reviews" aria-labelledby="reviewsTitle">
      <div className="reviewsHead">
        <h3 id="reviewsTitle" className="panelTitle">
          {t.reviewsTitle}
        </h3>
        <span className="hint">
          {score !== undefined && raters >= MIN_RATERS ? t.reviewsScore(score.toFixed(1), raters) : t.reviewsCollecting(reviews?.length ?? 0)}
        </span>
      </div>

      {!s.user ? (
        <button type="button" className="button" onClick={() => s.openAuth("login")}>
          {t.reviewsLogin}
        </button>
      ) : s.suspended ? (
        <p className="hint">{t.reviewsSuspended}</p>
      ) : (
        <form className="reviewForm" onSubmit={submit}>
          <fieldset className="stars">
            <legend>{t.reviewsMyRating}</legend>
            {[5, 4, 3, 2, 1].map((n) => (
              <Fragment key={n}>
                <input type="radio" id={`star-${n}`} name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} />
                <label htmlFor={`star-${n}`} title={t.reviewsStar(n)}>
                  <Star size={26} aria-hidden="true" fill="currentColor" />
                  <span className="srOnly">{t.reviewsStar(n)}</span>
                </label>
              </Fragment>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="review-body">{t.reviewsBody}</label>
            <textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} rows={3} />
          </div>
          <div className="buttonRow">
            <button type="submit" className="button primary" disabled={busy}>
              {mine ? t.reviewsUpdate : t.reviewsSave}
            </button>
            {mine && (
              <button type="button" className="button" onClick={remove} disabled={busy}>
                {t.reviewsDelete}
              </button>
            )}
          </div>
        </form>
      )}
      {message && (
        <p className="formNotice" role="status">
          {message}
        </p>
      )}

      {loadError ? (
        <p className="hint">{loadError}</p>
      ) : reviews && reviews.filter((r) => r.body).length === 0 ? (
        <p className="hint">{t.reviewsEmpty}</p>
      ) : (
        <ul className="reviewList">
          {(reviews ?? [])
            .filter((r) => r.body)
            .map((review) => (
              <li key={review.id}>
                <p className="reviewMeta">
                  <span className="star">
                    <Star size={12} aria-hidden="true" fill="currentColor" />
                    <span className="srOnly">{t.ratingLabel} </span>
                    {review.rating}
                  </span>
                  <span>{review.user_id === uid ? `${review.nickname} (${t.reviewsMine})` : review.nickname}</span>
                  <span>{review.created_at.slice(0, 10)}</span>
                  {review.user_id !== uid && (
                    <button type="button" className="linkButton" onClick={() => report(review)}>
                      <Flag size={12} aria-hidden="true" /> {t.reviewsReport}
                    </button>
                  )}
                </p>
                <p>{review.body}</p>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

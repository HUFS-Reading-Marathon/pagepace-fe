import { useState } from 'react';
import BookReviewActions from '../logs/BookReviewActions';
import type { ParticipantBook, ReviewTargetBook } from '../../types/readingLog';
import {
  loadReadingIntents,
  recommendReview,
  saveReadingIntents,
  type ReadingIntent,
} from '../../utils/reviewRecommendations';

type Props = {
  userId: number;
  participationId: number;
  targets: ReviewTargetBook[];
  progress: ParticipantBook[];
  previousBookIds: number[];
  selectedBookIds: number[];
  onReported: (target: ReviewTargetBook) => void;
};
export default function ReviewRecommendations({
  userId,
  participationId,
  targets,
  progress,
  previousBookIds,
  selectedBookIds,
  onReported,
}: Props) {
  const [intents, setIntents] = useState(() => loadReadingIntents(userId, participationId));
  const choose = (id: number, intent?: ReadingIntent) => {
    const next = { ...intents };
    if (intent) next[id] = intent;
    else delete next[id];
    setIntents(next);
    saveReadingIntents(userId, participationId, next);
  };
  const groups = targets.map((target) => ({
    target,
    kind: recommendReview(
      target,
      progress.find((b) => b.participantBookId === target.participantBookId),
      previousBookIds,
      selectedBookIds,
      intents[target.participantBookId],
    ),
  }));
  const recommendations = groups.filter((g) => ['completed', 'paused', 'ask'].includes(g.kind));
  const optional = groups.filter((g) => g.kind === 'optional');
  return (
    <>
      <p className="ux-form-note">
        같은 책에 쓴 여러 일지는 한 권으로 모입니다. 서평을 한 번 확인하면 이후 승인된 쪽수도
        자동으로 거리에 반영됩니다. 서평을 아직 쓰지 않았거나 확인을 기다리는 중이어도 다른
        독서일지는 제출할 수 있습니다.
      </p>
      {recommendations.map(({ target, kind }) => (
        <article className="review-suggestion" key={target.participantBookId}>
          <strong>{target.bookTitle}</strong>
          <p>
            일지 승인 {target.approvedReadPages} / {target.totalBookPages}쪽
          </p>
          {kind === 'ask' ? (
            <>
              <p>
                이전에 읽던 책도 계속 읽으시나요? 다른 책을 선택해도 동시에 읽는 중일 수 있어요.
              </p>
              <div className="review-intent-actions">
                <button type="button" onClick={() => choose(target.participantBookId, 'parallel')}>
                  두 책을 함께 읽어요
                </button>
                <button type="button" onClick={() => choose(target.participantBookId, 'paused')}>
                  이 책은 여기까지 읽을게요
                </button>
              </div>
              <small>선택하지 않아도 일지 제출에는 영향이 없습니다.</small>
            </>
          ) : (
            <>
              <p>
                {kind === 'completed'
                  ? '완독하셨네요. 읽은 내용을 도서관 서평으로 남겨 보세요.'
                  : `${target.totalBookPages}쪽을 다 읽지 않아도 지금까지 읽은 ${target.approvedReadPages}쪽에 대한 서평을 남길 수 있어요.`}
              </p>
              <BookReviewActions book={target} onReported={onReported} />
              {kind === 'paused' && (
                <button
                  type="button"
                  className="review-intent-reset"
                  onClick={() => choose(target.participantBookId, 'parallel')}
                >
                  이 책도 계속 읽을게요
                </button>
              )}
            </>
          )}
        </article>
      ))}
      {!recommendations.length && (
        <p className="ux-muted">
          지금 추천할 서평이 없습니다. 읽는 중인 책도 원할 때 서평을 작성할 수 있습니다.
        </p>
      )}
      {!!optional.length && (
        <details className="review-optional">
          <summary>읽는 중인 책도 서평 쓰기 ({optional.length}권)</summary>
          {optional.map(({ target }) => (
            <article className="review-suggestion" key={target.participantBookId}>
              <strong>{target.bookTitle}</strong>
              <p>
                {target.totalBookPages}쪽 중 승인 {target.approvedReadPages}쪽 · 완독 여부와
                관계없이 작성 가능
              </p>
              <BookReviewActions book={target} onReported={onReported} />
              <button
                type="button"
                className="review-intent-reset"
                onClick={() => choose(target.participantBookId, 'paused')}
              >
                이 책은 여기까지 읽을게요
              </button>
            </article>
          ))}
        </details>
      )}
    </>
  );
}

import { type FormEvent, useState } from 'react';
import { READING_LOG_REJECTION_REASONS } from '../../../types/adminReadingLog';

type ReadingLogRejectFormProps = {
  /** 서버가 추천한 반려 사유 (기본 사유 목록 앞에 표시) */
  recommendedReasons: string[];
  error?: string | null;
  isProcessing?: boolean;
  /** 반려 요청. 성공하면 true를 돌려줍니다. */
  onSubmit: (reason: string) => Promise<boolean>;
  /** 반려 성공 후 상세 화면으로 복귀 */
  onSuccess: () => void;
  onBack: () => void;
};

/** 상세 검토 다이얼로그의 반려 사유 입력 폼 */
function ReadingLogRejectForm({
  recommendedReasons,
  error = null,
  isProcessing = false,
  onSubmit,
  onSuccess,
  onBack,
}: ReadingLogRejectFormProps) {
  const [suggestedReason, setSuggestedReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const reasonOptions = [
    ...new Set([...recommendedReasons, ...READING_LOG_REJECTION_REASONS]),
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      setRejectionError('반려 사유를 입력해 주세요.');
      return;
    }

    const succeeded = await onSubmit(normalizedReason);

    if (succeeded) {
      setRejectionError('');
      onSuccess();
    }
  };

  const handleSuggestedReasonChange = (value: string) => {
    setSuggestedReason(value);
    setRejectionError('');

    if (value === '기타') {
      setRejectionReason('');
      return;
    }

    setRejectionReason(value);
  };

  return (
    <form className="admin-reading-log-dialog__form" onSubmit={handleSubmit}>
      <div className="admin-reading-log-dialog__content">
        <section className="admin-reading-log-dialog__section">
          <h3>반려 사유 입력</h3>
          <p className="admin-reading-log-dialog__mode-description">
            참가자는 이 사유를 확인하고 독서일지를 수정해 다시 제출할 수
            있습니다.
          </p>

          <label className="admin-reading-log-dialog__field">
            <span>사유 선택</span>
            <select
              value={suggestedReason}
              onChange={(event) =>
                handleSuggestedReasonChange(event.target.value)
              }
            >
              <option value="">사유를 선택해 주세요</option>
              {reasonOptions.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-reading-log-dialog__field">
            <span>최종 반려 사유</span>
            <textarea
              rows={5}
              value={rejectionReason}
              placeholder={
                suggestedReason === '기타'
                  ? '구체적인 반려 사유를 직접 입력해 주세요.'
                  : '선택한 사유를 보완하거나 직접 입력할 수 있습니다.'
              }
              aria-describedby={`readingLogRejectHint${
                rejectionError ? ' readingLogRejectError' : ''
              }`}
              onChange={(event) => {
                setRejectionReason(event.target.value);
                setRejectionError('');
              }}
            />
          </label>
          <p
            id="readingLogRejectHint"
            className="admin-reading-log-dialog__field-hint"
          >
            공백만 입력한 사유로는 반려할 수 없습니다.
          </p>
          {rejectionError && (
            <p
              id="readingLogRejectError"
              className="admin-reading-log-dialog__error"
              role="alert"
            >
              {rejectionError}
            </p>
          )}
          {error && (
            <p className="admin-reading-log-dialog__error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>

      <footer className="admin-reading-log-dialog__actions">
        <button
          type="submit"
          className="admin-reading-log-dialog__button admin-reading-log-dialog__button--danger"
          disabled={isProcessing}
        >
          {isProcessing ? '반려 중…' : '반려하기'}
        </button>
        <button
          type="button"
          className="admin-reading-log-dialog__button"
          disabled={isProcessing}
          onClick={() => {
            setRejectionError('');
            onBack();
          }}
        >
          돌아가기
        </button>
      </footer>
    </form>
  );
}

export default ReadingLogRejectForm;

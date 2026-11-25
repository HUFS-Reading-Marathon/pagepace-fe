import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { READING_LOG_REJECTION_REASONS } from '../../../types/adminReadingLog';

type Props = {
  recommendedReasons: string[];
  isProcessing: boolean;
  onSubmit: (reason: string) => Promise<boolean>;
  onSuccess: () => void;
  onBack: () => void;
  /** 반려 사유를 입력하는 중인지 알립니다. 다른 일지로 옮길 때 입력 손실을 막는 데 씁니다. */
  onDirtyChange?: (dirty: boolean) => void;
};

export default function ReadingLogRejectForm({
  recommendedReasons,
  isProcessing,
  onSubmit,
  onSuccess,
  onBack,
  onDirtyChange,
}: Props) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const options = [...new Set([...recommendedReasons, ...READING_LOG_REJECTION_REASONS])].filter(
    (value) => value.trim() && value !== '기타',
  );

  useEffect(() => {
    input.current?.focus();
  }, []);

  const dirty = reason.trim().length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isProcessing) return;
    if (!reason.trim()) {
      setError('반려 사유를 입력해 주세요.');
      input.current?.focus();
      return;
    }
    if (await onSubmit(reason.trim())) onSuccess();
  }

  return (
    <form className="log-review__reject" aria-label="독서일지 반려" onSubmit={submit}>
      <div className="log-review__reject-labels">
        <label htmlFor={id}>반려 사유</label>
        <select
          aria-label="자주 쓰는 반려 사유"
          value=""
          disabled={isProcessing}
          onChange={(event) => {
            setReason(event.target.value);
            setError('');
            input.current?.focus();
          }}
        >
          <option value="" disabled>
            자주 쓰는 사유 선택
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <textarea
        ref={input}
        id={id}
        rows={3}
        value={reason}
        disabled={isProcessing}
        placeholder="참가자에게 전달할 사유를 입력하세요."
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={error ? id + '-error' : undefined}
        onChange={(event) => {
          setReason(event.target.value);
          setError('');
        }}
      />
      {error && (
        <p id={id + '-error'} className="log-review__error" role="alert">
          {error}
        </p>
      )}
      <div className="log-review__actions">
        <button type="button" className="admin-button" disabled={isProcessing} onClick={onBack}>
          취소
        </button>
        <button type="submit" className="admin-button admin-button--danger" disabled={isProcessing}>
          반려하기
        </button>
      </div>
    </form>
  );
}

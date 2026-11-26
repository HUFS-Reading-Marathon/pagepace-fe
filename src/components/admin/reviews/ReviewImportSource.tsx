import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { ReviewImportBatch, ReviewImportHistory } from '../../../api/reviewImportApi';
import { formatKoDateTime24 } from '../../../utils/date';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type ReviewImportSourceProps = {
  history: ReviewImportHistory | null;
  batch: ReviewImportBatch | null;
  isLoading: boolean;
  busy: boolean;
  readOnly: boolean;
  onSelectBatch: (batchId: number) => void;
  onHistoryPage: (page: number) => void;
  onUpload: (file: File) => Promise<boolean>;
  onInvalidFile: (message: string) => void;
};

/** 파일 용량 표시(KB·MB) */
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 'ⓘ 이용 방법' 버튼과 팝오버: 솔라스 자료를 준비하는 순서와 엑셀 열 정보를 보여 줍니다. */
function UsageHelp() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className="admin-review-help" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="admin-review-help__button"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">ⓘ</span> 이용 방법
      </button>
      {open && (
        <div
          id={popoverId}
          className="admin-review-help__popover"
          role="dialog"
          aria-label="이용 방법"
        >
          <ol>
            <li>솔라스에서 대회 기간으로 서평을 조회합니다.</li>
            <li>조회 결과를 엑셀(.xlsx)로 내려받습니다.</li>
            <li>파일을 올리면 승인된 독서일지와 회원번호·도서를 대조합니다.</li>
          </ol>
          <p>
            업로드만으로는 거리가 반영되지 않습니다. 대조 결과를 확인한 뒤 반영할 서평을 고릅니다.
          </p>
          <p>열 순서: ID, TITLE, ETC_CONTENT, MEMBER_NO, NAME, TITLE_1, CONTENT, LAST_UPDATED</p>
        </div>
      )}
    </span>
  );
}

function validateFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'xlsx 파일만 올릴 수 있습니다.';
  if (file.size === 0) return '빈 파일입니다. 솔라스에서 다시 내려받아 주세요.';
  if (file.size > MAX_FILE_BYTES) return '5MB 이하의 파일만 올릴 수 있습니다.';
  return '';
}

/**
 * 대조 자료 영역: 현재 대조 중인 업로드, 이전 업로드 선택, 새 엑셀 업로드를 한 줄에서 처리합니다.
 * 업로드 내역이 없으면 한 줄 파일 첨부 화면(이용 방법은 팝오버)을 보여 줍니다.
 */
function ReviewImportSource({
  history,
  batch,
  isLoading,
  busy,
  readOnly,
  onSelectBatch,
  onHistoryPage,
  onUpload,
  onInvalidFile,
}: ReviewImportSourceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDisabled = busy || isLoading || readOnly;
  const hasBatches = !!history && history.batches.length > 0;

  const chooseFile = (next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }

    const problem = validateFile(next);

    if (problem) {
      onInvalidFile(problem);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!file || uploadDisabled) return;

    if (await onUpload(file)) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
    if (uploadDisabled) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (uploadDisabled) return;
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  };

  const uploadForm = (
    <form
      className={`admin-review-source__upload${isDragging ? ' is-dragging' : ''}`}
      onSubmit={submit}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        id="reviewImportFile"
        className="admin-review-source__file-input"
        type="file"
        accept=".xlsx"
        aria-label="솔라스 서평 엑셀 파일"
        disabled={uploadDisabled}
        onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
      />
      <label
        htmlFor="reviewImportFile"
        className="admin-button"
        aria-disabled={uploadDisabled || undefined}
      >
        엑셀 파일 선택
      </label>
      <span className={`admin-review-source__file${file ? ' is-selected' : ''}`}>
        {file ? file.name : hasBatches ? '새 자료를 올리면 다시 대조합니다' : '선택한 파일 없음'}
      </span>
      <button
        type="submit"
        className="admin-button admin-button--primary"
        disabled={!file || uploadDisabled}
      >
        {busy && file ? '대조 중…' : '업로드 후 대조'}
      </button>
    </form>
  );

  if (isLoading) {
    return (
      <section className="admin-review-source" aria-label="대조 자료">
        <p className="admin-review-source__loading" role="status">
          업로드 내역을 불러오는 중입니다.
        </p>
      </section>
    );
  }

  if (!hasBatches) {
    const clearFile = () => {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
      <section className="admin-review-source admin-review-source--empty" aria-label="대조 자료">
        <div className="admin-review-intro__head">
          <h2>솔라스 서평 대조</h2>
          <UsageHelp />
        </div>
        <form
          className="admin-review-intro__form"
          onSubmit={submit}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            id="reviewImportFile"
            className="admin-review-source__file-input"
            type="file"
            accept=".xlsx"
            aria-label="솔라스 서평 엑셀 파일"
            disabled={uploadDisabled}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <div
            className={`admin-review-intro__drop${isDragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
          >
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
              <path d="M8 3.5h11.5L25 9v19.5H8z" />
              <path d="M19.5 3.5V9H25" />
              <path d="M12.5 17h7M12.5 21h7" />
            </svg>
            {file ? (
              <>
                <p className="admin-review-intro__file" title={file.name}>
                  <strong>{file.name}</strong>
                  <span>{formatFileSize(file.size)}</span>
                </p>
                <div className="admin-review-intro__drop-actions">
                  <label
                    htmlFor="reviewImportFile"
                    className="admin-button"
                    aria-disabled={uploadDisabled || undefined}
                  >
                    다른 파일 선택
                  </label>
                  <button
                    type="button"
                    className="admin-review-intro__clear"
                    disabled={uploadDisabled}
                    onClick={clearFile}
                  >
                    선택 취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="admin-review-intro__prompt">서평 엑셀 파일을 선택해 주세요.</p>
                <p className="admin-review-intro__limits">.xlsx · 최대 5MB · 최대 2,000행</p>
                <label
                  htmlFor="reviewImportFile"
                  className="admin-button"
                  aria-disabled={uploadDisabled || undefined}
                >
                  파일 선택
                </label>
              </>
            )}
          </div>

          <div className="admin-review-intro__footer">
            <p>대조 결과를 확인한 후 인정 거리를 반영할 수 있습니다.</p>
            <button
              type="submit"
              className="admin-button admin-button--primary"
              disabled={!file || uploadDisabled}
            >
              {busy && file ? '대조 중…' : '대조하기'}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-review-source" aria-label="대조 자료">
      <div className="admin-review-source__current">
        <span className="admin-review-source__label">대조 자료</span>
        {batch ? (
          <>
            <strong title={batch.filename}>{batch.filename}</strong>
            <span>
              {formatKoDateTime24(batch.createdAt)} · {batch.uploadedBy} ·{' '}
              {batch.rowCount.toLocaleString('ko-KR')}행
            </span>
          </>
        ) : (
          <strong>업로드 내역을 선택해 주세요</strong>
        )}
      </div>

      <div className="admin-review-source__history">
        <label htmlFor="reviewImportHistory">업로드 내역</label>
        <select
          id="reviewImportHistory"
          disabled={busy}
          value={batch?.id ?? ''}
          onChange={(event) => {
            if (event.target.value) onSelectBatch(Number(event.target.value));
          }}
        >
          {!batch && <option value="">업로드를 선택해 주세요</option>}
          {history.batches.map((item) => (
            <option key={item.id} value={item.id}>
              {formatKoDateTime24(item.createdAt)} · {item.filename} · {item.rowCount}행
            </option>
          ))}
        </select>
        {history.totalPages > 1 && (
          <div className="admin-review-source__history-pages">
            <button
              type="button"
              disabled={busy || history.page === 0}
              onClick={() => onHistoryPage(history.page - 1)}
            >
              최근 내역
            </button>
            <span>
              {history.page + 1}/{history.totalPages}
            </span>
            <button
              type="button"
              disabled={busy || history.page + 1 >= history.totalPages}
              onClick={() => onHistoryPage(history.page + 1)}
            >
              이전 내역
            </button>
          </div>
        )}
      </div>

      {uploadForm}
    </section>
  );
}

export default ReviewImportSource;

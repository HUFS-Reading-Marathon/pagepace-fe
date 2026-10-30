import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../api/apiClient';
import {
  confirmImportedReview, getReviewImportDetail, getReviewImportHistory, uploadReviewExcel,
  type ImportedReview, type ReviewConfirmation, type ReviewImportDetail, type ReviewImportHistory,
} from '../../../api/reviewImportApi';

const REVIEW_IMPORT_STATUS = {
  MATCHED: '회원번호·도서 ID 일치', NEEDS_REVIEW: '추가 확인 필요', UNMATCHED: '대조 대상 없음',
  INVALID: '자료 오류', NO_CREDIT: '현재 반영 불가', ALREADY_APPLIED: '이미 반영한 서평',
} as const;

export function ImportedReviewRow({ row, busy, onConfirm }: {
  row: ImportedReview; busy: boolean; onConfirm: (row: ImportedReview, request: ReviewConfirmation) => Promise<void>;
}) {
  const [bookId, setBookId] = useState(row.candidates.length === 1 ? row.candidates[0].participantBookId : 0);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const candidate = row.candidates.find(book => book.participantBookId === bookId);
  const eligible = row.status === 'MATCHED' || row.status === 'NEEDS_REVIEW';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!candidate || !checked || busy || !eligible || (row.warnings.length > 0 && !note.trim())) return;
    if (!window.confirm(`${candidate.name}님의 “${candidate.bookTitle}”에 ${candidate.distanceToCreditMeter.toLocaleString()}m를 반영할까요?`)) return;
    await onConfirm(row, { participantBookId: candidate.participantBookId, expectedApprovedPages: candidate.approvedPages,
      expectedUncreditedPages: candidate.uncreditedPages, evidenceChecked: checked, note: note.trim() });
  };
  return <article>
    <p>엑셀 {row.sourceRow}행 · {REVIEW_IMPORT_STATUS[row.status]}</p>
    <h3>{row.memberName} · {row.memberNo}</h3>
    <h4>{row.bookTitle} <small>도서 ID {row.libraryBookId ?? '오류'}</small></h4>
    <p>{row.bibliographicInfo}</p>
    <p>최종 수정일: {row.sourceUpdatedAt?.replace('T', ' ') ?? '날짜 오류'}</p>
    <details><summary>서평 원문: {row.reviewTitle || '제목 없음'}</summary>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.content || '본문 없음'}</p>
    </details>
    {row.warnings.length > 0 && <ul>{row.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    {row.verification && <p role="status">{row.verification.verifiedBy} · {row.verification.verifiedAt.replace('T', ' ')} 확인 / {row.verification.creditedPages.toLocaleString()}쪽, {row.verification.creditedDistanceMeter.toLocaleString()}m 반영 이력</p>}
    {eligible && <form onSubmit={submit}>
      <label>반영할 참가 도서 <select aria-label={`엑셀 ${row.sourceRow}행 참가 도서`} disabled={busy} value={bookId || ''} onChange={event => { setBookId(Number(event.target.value)); setChecked(false); }}>
        <option value="">도서를 선택해 주세요</option>
        {row.candidates.map(book => <option key={book.participantBookId} value={book.participantBookId}>{book.name} · {book.bookTitle} · ID {book.libraryBookId}</option>)}
      </select></label>
      {candidate && <dl><div><dt>승인 쪽수</dt><dd>{candidate.approvedPages.toLocaleString()}쪽</dd></div><div><dt>추가 반영</dt><dd>{candidate.uncreditedPages.toLocaleString()}쪽 / {candidate.distanceToCreditMeter.toLocaleString()}m</dd></div></dl>}
      <p><label>검토 메모{row.warnings.length > 0 ? ' (필수)' : ' (선택)'}<br />
        <textarea aria-label={`엑셀 ${row.sourceRow}행 검토 메모`} disabled={busy} required={row.warnings.length > 0} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} rows={2} />
      </label></p>
      <p><label><input type="checkbox" disabled={busy || !candidate} checked={checked} onChange={event => setChecked(event.target.checked)} /> 작성자·도서·서평 내용과 행사 인정 기간을 확인했습니다.</label></p>
      <div className="admin-reviews__actions"><button type="submit" disabled={busy || !candidate || !checked || (row.warnings.length > 0 && !note.trim())}>확인 후 거리 반영</button></div>
    </form>}
  </article>;
}

export default function ReviewExcelImport({ eventId, onBusyChange, onVerified }: {
  eventId: number; onBusyChange: (busy: boolean) => void; onVerified: () => Promise<void>;
}) {
  const [history, setHistory] = useState<ReviewImportHistory | null>(null);
  const [detail, setDetail] = useState<ReviewImportDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    getReviewImportHistory(eventId).then(next => { if (active) setHistory(next); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : '업로드 내역을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusyChange(true); setError(''); setMessage('');
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'); }
    finally { inFlight.current = false; setBusy(false); onBusyChange(false); }
  };
  const open = (id: number, page = 0) => run(async () => { setDetail(null); setDetail(await getReviewImportDetail(eventId, id, page)); });
  const upload = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!file || !file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024 || file.size === 0)
        throw new Error('5MB 이하의 xlsx 파일을 선택해 주세요.');
      const batch = await uploadReviewExcel(eventId, file);
      setFile(null); if (fileInput.current) fileInput.current.value = '';
      setMessage(`${batch.rowCount}행을 업로드했습니다. 아직 거리는 반영되지 않았습니다.`);
      setHistory(await getReviewImportHistory(eventId));
      setDetail(await getReviewImportDetail(eventId, batch.id));
    });
  };
  const confirm = (row: ImportedReview, request: ReviewConfirmation) => run(async () => {
    if (!detail) return;
    try {
      const result = await confirmImportedReview(eventId, detail.batch.id, row.id, request);
      setMessage(result.alreadyApplied ? '이미 반영한 서평입니다. 거리를 추가하지 않았습니다.' : `${result.creditedPages}쪽, ${result.creditedDistanceMeter.toLocaleString()}m를 반영했습니다.`);
    } catch (error) {
      if (error instanceof ApiError && ['REVIEW_TOTALS_CHANGED', 'REVIEW_NOT_ELIGIBLE', 'REVIEW_MATCH_REQUIRED'].includes(error.code ?? ''))
        setDetail(await getReviewImportDetail(eventId, detail.batch.id, detail.page));
      throw error;
    }
    try { setDetail(await getReviewImportDetail(eventId, detail.batch.id, detail.page)); await onVerified(); }
    catch { setError('거리 반영은 완료했지만 목록 갱신에 실패했습니다. 대조 결과를 새로 조회해 주세요.'); }
  });
  return <section aria-label="솔라스 서평 엑셀 대조">
    <h2>솔라스 서평 엑셀 대조</h2>
    <p>선택한 행사에 자료를 업로드한 뒤 작성자와 도서를 확인해 주세요. 업로드만으로는 거리가 반영되지 않습니다.</p>
    <p>최종 수정일은 최초 작성일이 아닙니다. 행사 인정 기간을 별도로 확인하며, 추가 확인 항목이 있으면 검토 메모를 남겨 주세요.</p>
    <form onSubmit={upload}><label>솔라스 엑셀 (.xlsx, 최대 5MB·2,000행)<br /><input ref={fileInput} aria-label="솔라스 서평 엑셀 파일" type="file" accept=".xlsx" disabled={busy || loading} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <div className="admin-reviews__actions"><button type="submit" disabled={!file || busy || loading}>{busy ? '처리 중…' : '업로드 및 대조'}</button></div>
    </form>
    {error && <p role="alert" className="admin-reviews__error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {loading ? <p role="status">업로드 내역을 불러오는 중입니다.</p> : <>
      <p><label>업로드 내역 <select aria-label="서평 업로드 내역" disabled={busy} value={detail?.batch.id ?? ''} onChange={event => { if (event.target.value) void open(Number(event.target.value)); }}>
        <option value="">업로드를 선택해 주세요</option>{history?.batches.map(batch => <option key={batch.id} value={batch.id}>{batch.createdAt.replace('T', ' ')} · {batch.filename} · {batch.rowCount}행</option>)}
      </select></label></p>
      {history && history.totalPages > 1 && <div className="admin-reviews__actions">
        <button disabled={busy || history.page === 0} onClick={() => void run(async () => { setHistory(await getReviewImportHistory(eventId, history.page - 1)); setDetail(null); })}>이전 업로드 내역</button>
        <span>{history.page + 1} / {history.totalPages}</span>
        <button disabled={busy || history.page + 1 >= history.totalPages} onClick={() => void run(async () => { setHistory(await getReviewImportHistory(eventId, history.page + 1)); setDetail(null); })}>다음 업로드 내역</button>
      </div>}
    </>}
    {detail && <>
      <h3>{detail.batch.eventTitle} · {detail.batch.filename}</h3>
      <p>총 {detail.batch.rowCount}행 · {detail.page + 1} / {detail.totalPages}페이지 · 업로드: {detail.batch.uploadedBy}</p>
      <div className="admin-reviews__actions">
        <button disabled={busy || detail.page === 0} onClick={() => void open(detail.batch.id, detail.page - 1)}>이전 50행</button>
        <button disabled={busy} onClick={() => void open(detail.batch.id, detail.page)}>대조 결과 새로고침</button>
        <button disabled={busy || detail.page + 1 >= detail.totalPages} onClick={() => void open(detail.batch.id, detail.page + 1)}>다음 50행</button>
      </div>
      <div className="admin-reviews__grid">{detail.rows.map(row => <ImportedReviewRow key={`${row.id}-${row.status}-${row.candidates.map(c => `${c.participantBookId}:${c.approvedPages}:${c.uncreditedPages}`).join(',')}`} row={row} busy={busy} onConfirm={confirm} />)}</div>
    </>}
  </section>;
}

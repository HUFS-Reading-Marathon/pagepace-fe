import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportedReviewRow } from '../src/components/admin/reviews/ReviewExcelImport';
import {
  uploadReviewExcel,
  confirmImportedReview,
  type ImportedReview,
} from '../src/api/reviewImportApi';
import { apiRequest } from '../src/api/apiClient';
vi.mock('../src/api/apiClient', () => ({ apiRequest: vi.fn(), ApiError: class extends Error {} }));
const row: ImportedReview = {
  id: 4,
  sourceRow: 2,
  libraryBookId: 1,
  bookTitle: 'book',
  bibliographicInfo: 'author',
  memberNo: '001234567',
  memberName: '테스트',
  reviewTitle: '서평',
  content: '<script>alert(1)</script>',
  sourceUpdatedAt: '2026-01-04T07:37:13',
  status: 'MATCHED',
  warnings: [],
  verification: null,
  candidates: [
    {
      participantBookId: 9,
      name: '테스트',
      studentNo: '001234567',
      bookTitle: 'book',
      libraryBookId: 1,
      approvedPages: 200,
      uncreditedPages: 50,
      distanceToCreditMeter: 250,
      matchType: 'LIBRARY_ID',
    },
  ],
};
afterEach(() => vi.clearAllMocks());
describe('솔라스 자료 대조 기능', () => {
  it('원문 HTML을 실행하지 않고 미인정 쪽수 차액을 보여준다', () => {
    const html = renderToStaticMarkup(
      <ImportedReviewRow row={row} busy={false} onConfirm={async () => {}} />,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('250m');
    expect(html).toContain('001234567');
    expect(html).toContain('type="submit" disabled');
  });
  it('미일치 또는 이미 처리한 행에 승인 버튼을 제공하지 않는다', () => {
    for (const status of ['UNMATCHED', 'INVALID', 'NO_CREDIT', 'ALREADY_APPLIED'] as const) {
      const html = renderToStaticMarkup(
        <ImportedReviewRow
          row={{ ...row, status, candidates: [] }}
          busy={false}
          onConfirm={async () => {}}
        />,
      );
      expect(html).not.toContain('type="submit"');
    }
  });
  it('업로드는 선택한 행사와 FormData로 보내고 boundary를 직접 설정하지 않는다', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: 5 });
    const file = new File(['test'], 'export.xlsx');
    await uploadReviewExcel(7, file);
    const [url, options] = vi.mocked(apiRequest).mock.calls[0];
    expect(url).toContain('eventId=7');
    expect(options?.body).toBeInstanceOf(FormData);
    expect(options?.headers).toBeUndefined();
    expect((options?.body as FormData).get('file')).toBeInstanceOf(File);
  });
  it('최종 확인은 행사·업로드·원본 행과 미리보기 승인량을 함께 전송한다', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: 8 });
    const request = {
      participantBookId: 9,
      expectedApprovedPages: 200,
      expectedUncreditedPages: 50,
      evidenceChecked: true,
      note: '확인',
    };
    await confirmImportedReview(7, 5, 4, request);
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/admin/review-imports/5/rows/4/confirm?eventId=7',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    );
  });
});

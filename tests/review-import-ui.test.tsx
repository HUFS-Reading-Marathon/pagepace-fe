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
import {
  compareReviewTime,
  verifyAdminReview,
  type AdminReviewTarget,
} from '../src/api/adminReadingLogApi';
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
      uncreditedPages: 87,
      distanceToCreditMeter: 435,
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
    expect(html).toContain('87쪽 / 435m');
    expect(html).toContain('001234567');
    expect(html).toContain('type="submit" disabled');
  });
  it('제외된 비참가자 행에는 행 번호와 제외 사유만 표시한다', () => {
    const html = renderToStaticMarkup(
      <ImportedReviewRow
        row={{ ...row, status: 'EXCLUDED', warnings: ['이 행사 비참가자입니다.'] }}
        busy={false}
        onConfirm={async () => {}}
      />,
    );
    expect(html).toContain('엑셀 2행');
    expect(html).toContain('행사 비참가자 제외');
    expect(html).toContain('이 행사 비참가자입니다.');
    for (const value of ['도서 ID', '날짜 오류', '001234567', '서평 원문', 'type="submit"'])
      expect(html).not.toContain(value);
  });
  it('미일치 또는 이미 처리한 행에 승인 버튼을 제공하지 않는다', () => {
    for (const status of [
      'UNMATCHED',
      'INVALID',
      'NO_CREDIT',
      'BOOK_VERIFIED',
      'ALREADY_APPLIED',
    ] as const) {
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
      expectedUncreditedPages: 87,
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

describe('관리자 서평 확인', () => {
  const target: AdminReviewTarget = {
    participantBookId: 1,
    participationId: 1,
    userId: 1,
    userName: '참가자',
    studentNo: '001234567',
    bookTitle: '기록하는 숲',
    author: null,
    approvedReadPages: 87,
    distanceToCreditMeter: 435,
    reviewSubmittedAt: null,
    reviewVerifiedAt: null,
    reviewVerified: false,
    reviewSearchUrl: null,
  };
  it('제출 시각이 없는 솔라스 확인 건은 확인 시각으로 정렬하고 시각을 모르는 건은 항상 마지막에 둔다', () => {
    const reviews = [
      { ...target, participantBookId: 2, reviewSubmittedAt: '2026-11-20T11:00:00' },
      target,
      { ...target, participantBookId: 3, reviewVerifiedAt: '2026-11-20T10:00:00' },
      { ...target, participantBookId: 4, reviewVerifiedAt: '2026-11-20T10:00:00' },
    ];
    expect([...reviews].sort(compareReviewTime).map((r) => r.participantBookId)).toEqual([
      3, 4, 2, 1,
    ]);
    expect(
      [...reviews].sort((a, b) => compareReviewTime(a, b, -1)).map((r) => r.participantBookId),
    ).toEqual([2, 3, 4, 1]);
  });
  it('수동 확인은 원문 시각·본문과 조회 당시 누적값을 JSON으로 전송하고 실제 남은 분량을 반환한다', async () => {
    const evidence = {
      sourceUpdatedAt: '2026-11-20T10:15:23',
      sourceContent: '도서관의 서평 본문',
      expectedApprovedPages: 87,
      expectedUncreditedPages: 87,
      evidenceChecked: true,
    };
    const result = { ...target, distanceToCreditMeter: 0 };
    vi.mocked(apiRequest).mockResolvedValue(result);
    await expect(verifyAdminReview(1, evidence)).resolves.toEqual(result);
    expect(apiRequest).toHaveBeenCalledWith('/api/admin/reading-logs/review-targets/1/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidence),
    });
  });
});

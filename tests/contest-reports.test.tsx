import React from 'react';
import { inflateRawSync } from 'node:zlib';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/api/apiClient';
import { MOCK_ADMIN_LOGIN } from '../src/mocks/mockDb';
import { handleMockRequest, resetMockDb } from '../src/mocks/mockHandlers';
import { REPORT_SCENARIO_KEY } from '../src/mocks/mockReports';
import { buildXlsx, looksLikeXlsx } from '../src/mocks/mockXlsx';
import AdminContestReportsPage from '../src/pages/admin/AdminContestReportsPage';
import {
  formatReportDate,
  isAcceptableReviewFile,
  reportErrorMessage,
  reportFileName,
  reportSuccessFeedback,
} from '../src/pages/admin/contestReportFeedback';

const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 압축 방식과 관계없이 ZIP의 파일 목록과 내용을 읽습니다(중앙 디렉터리 기준). */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  expect(end).toBeGreaterThanOrEqual(0);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extra = view.getUint16(offset + 30, true);
    const comment = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const dataStart =
      local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    files.set(name, new TextDecoder().decode(method === 0 ? data : inflateRawSync(data)));
    offset += 46 + nameLength + extra + comment;
  }
  return files;
}

async function adminToken() {
  const response = await handleMockRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ studentNo: MOCK_ADMIN_LOGIN, password: 'any' }),
  });
  return ((await response.json()) as { data: { accessToken: string } }).data.accessToken;
}

const auth = (token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, Accept: `${EXCEL}, application/json` },
});

describe('결과 보고서 안내 문구', () => {
  it('인증·권한·네트워크·서버 오류를 서로 다른 문구로 보여 준다', () => {
    expect(reportErrorMessage(new ApiError('인증이 필요합니다.', 401, 'UNAUTHORIZED'))).toBe(
      '인증이 필요합니다. 로그인 상태를 확인해 주세요.',
    );
    expect(reportErrorMessage(new ApiError('접근 권한이 없습니다.', 403, 'ACCESS_DENIED'))).toBe(
      '해당 보고서를 다운로드할 권한이 없습니다.',
    );
    expect(
      reportErrorMessage(
        new ApiError(
          '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
          0,
          'NETWORK_ERROR',
        ),
      ),
    ).toBe('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
    expect(
      reportErrorMessage(new ApiError('서버 오류가 발생했습니다.', 500, 'INTERNAL_ERROR')),
    ).toBe('파일 생성에 실패했습니다. 다시 시도해 주세요.');
    expect(reportErrorMessage(new Error('boom'))).toBe(
      '파일 생성에 실패했습니다. 다시 시도해 주세요.',
    );
  });

  it('파일·행사처럼 서버가 구체적으로 알려 준 4xx 오류는 서버 문구를 쓰고, 엑셀이 아닌 정상 응답은 실패로 본다', () => {
    expect(
      reportErrorMessage(
        new ApiError('솔라스 엑셀의 8개 열 제목을 확인해 주세요.', 400, 'INVALID_REVIEW_FILE'),
      ),
    ).toBe('솔라스 엑셀의 8개 열 제목을 확인해 주세요.');
    expect(
      reportErrorMessage(new ApiError('행사를 찾을 수 없습니다.', 404, 'EVENT_NOT_FOUND')),
    ).toBe('행사를 찾을 수 없습니다.');
    // 개발 서버가 index.html을 200으로 돌려준 경우처럼 서버 오류 코드가 없는 응답
    expect(reportErrorMessage(new ApiError('엑셀 파일을 내려받지 못했습니다.', 200))).toBe(
      '파일 생성에 실패했습니다. 다시 시도해 주세요.',
    );
  });

  it('도서 목록은 청구기호 누락 건수가 있으면 주의로, 그 외에는 다운로드 시작으로 안내한다', () => {
    expect(reportSuccessFeedback('books', 3)).toEqual({
      tone: 'warning',
      text: '다운로드를 시작했습니다. 청구기호를 확인하지 못한 도서 3권은 목록 마지막에 있으니 확인해 주세요.',
    });
    expect(reportSuccessFeedback('books', 0).tone).toBe('success');
    expect(reportSuccessFeedback('participants', 3).tone).toBe('success');
    expect(reportSuccessFeedback('journals', 0).text).not.toContain('저장');
  });

  it('업로드 조건(.xlsx, 20MB 이하), 날짜 표기, 파일 이름 규칙을 유지한다', () => {
    expect(isAcceptableReviewFile({ name: '서평.XLSX', size: 20 * 1024 * 1024 })).toBe(true);
    expect(isAcceptableReviewFile({ name: '서평.xlsx', size: 20 * 1024 * 1024 + 1 })).toBe(false);
    expect(isAcceptableReviewFile({ name: '서평.xls', size: 10 })).toBe(false);
    expect(formatReportDate('2026-12-02')).toBe('2026.12.02');
    expect(reportFileName(6, 'journals')).toBe('제6회_일지+서평.xlsx');
  });
});

describe('결과 보고서 화면', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <AdminContestReportsPage />
    </MemoryRouter>,
  );

  it('세 보고서 버튼은 같은 문구를 쓰고 접근성 이름에 보고서 종류를 담는다', () => {
    expect(html.match(/>엑셀 다운로드</g)).toHaveLength(3);
    for (const name of ['참가자 현황', '도서 목록', '일지 + 서평']) {
      expect(html).toContain(`aria-label="${name} 엑셀 다운로드"`);
    }
  });

  it('명단 범위 요청값과 업로드 조건 안내를 유지하고, 파일을 고르기 전에는 일지 + 서평 버튼이 꺼져 있다', () => {
    expect(html).toContain('<option value="PARTICIPANTS" selected="">승인·완주 참가자</option>');
    expect(html).toContain('<option value="APPLICANTS">전체 신청자 (철회 제외)</option>');
    expect(html).toContain('accept=".xlsx,');
    expect(html).toContain('최대 20MB');
    expect(html).toContain('선택된 파일 없음');
    expect(html).toMatch(/aria-label="일지 \+ 서평 엑셀 다운로드"[^>]*disabled=""/);
  });
});

describe('목데이터 결과 보고서', () => {
  beforeEach(() => resetMockDb());
  afterEach(() => vi.unstubAllGlobals());

  it('참가자 현황은 실제로 열리는 xlsx이며 학번·연락처를 문자로 저장하고 명단 범위에 따라 대상이 달라진다', async () => {
    const token = await adminToken();
    const rows = async (scope: string) => {
      const response = await handleMockRequest(
        `/api/admin/reports/6/participants?scope=${scope}`,
        auth(token),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(EXCEL);
      const sheet = readZip(new Uint8Array(await response.arrayBuffer())).get(
        'xl/worksheets/sheet1.xml',
      )!;
      expect(sheet).toContain('<t xml:space="preserve">2. 학번 또는 사번</t>');
      expect(sheet).not.toMatch(/<c r="C\d+"><v>/); // 학번 열이 숫자 셀로 바뀌지 않음
      return (sheet.match(/<row /g) ?? []).length - 2;
    };
    const participants = await rows('PARTICIPANTS');
    const applicants = await rows('APPLICANTS');
    expect(participants).toBe(34);
    expect(applicants).toBe(46); // 48건 중 철회 2건 제외
  });

  it('도서 목록은 청구기호 누락 건수를 헤더로 알리고 제목에 도서관 상세 링크를 단다', async () => {
    const token = await adminToken();
    const response = await handleMockRequest('/api/admin/reports/6/books', auth(token));
    expect(response.headers.get('X-Missing-Call-Numbers')).toBe('2');
    const files = readZip(new Uint8Array(await response.arrayBuffer()));
    expect(files.get('xl/worksheets/_rels/sheet1.xml.rels')).toContain(
      'https://lib.hufs.ac.kr/global/search/i-discovery/',
    );
    const empty = await handleMockRequest('/api/admin/reports/7/books', auth(token));
    expect(empty.headers.get('X-Missing-Call-Numbers')).toBe('0');
  });

  it('일지 + 서평은 xlsx가 아닌 파일·빠진 파일을 거절하고, 올바른 파일이면 보고서를 만든다', async () => {
    const token = await adminToken();
    const upload = async (file?: File) => {
      const body = new FormData();
      if (file) body.append('file', file);
      return handleMockRequest(
        '/api/admin/reports/6/journals',
        auth(token, { method: 'POST', body }),
      );
    };
    const broken = await upload(new File(['not a workbook'], 'broken.xlsx'));
    expect(broken.status).toBe(400);
    expect(((await broken.json()) as { message: string }).message).toContain(
      '엑셀을 읽을 수 없습니다',
    );
    expect((await upload()).status).toBe(400);
    const valid = await upload(
      new File([buildXlsx({ name: 'Export', rows: [['ID']] })], 'solas.xlsx'),
    );
    expect(valid.status).toBe(200);
    expect(valid.headers.get('Content-Type')).toBe(EXCEL);
    expect(looksLikeXlsx(new Uint8Array(await valid.arrayBuffer()))).toBe(true);
  });

  it('로그인하지 않았거나 없는 행사면 엑셀 대신 JSON 오류를 돌려준다', async () => {
    const token = await adminToken();
    expect((await handleMockRequest('/api/admin/reports/6/books')).status).toBe(401);
    const missing = await handleMockRequest('/api/admin/reports/999/books', auth(token));
    expect(missing.status).toBe(404);
    expect(missing.headers.get('Content-Type')).toBe('application/json');
  });

  it('오류 재현 스위치로 권한 부족·서버 오류·인증 오류를 만든다', async () => {
    const token = await adminToken();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    const statusFor = async (scenario: string) => {
      store.set(REPORT_SCENARIO_KEY, scenario);
      return (await handleMockRequest('/api/admin/reports/6/books', auth(token))).status;
    };
    expect(await statusFor('forbidden')).toBe(403);
    expect(await statusFor('server-error')).toBe(500);
    expect(await statusFor('unauthorized')).toBe(401);
    store.set(REPORT_SCENARIO_KEY, 'network');
    await expect(handleMockRequest('/api/admin/reports/6/books', auth(token))).rejects.toThrow();
  });
});

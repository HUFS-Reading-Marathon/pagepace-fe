import { ApiError } from '../../api/apiClient';

export type ContestReport = 'participants' | 'books' | 'journals';
export type FeedbackTone = 'error' | 'success' | 'warning' | 'progress';
export type ReportFeedback = { tone: FeedbackTone; text: string };

/** 화면 제목(접근성 이름에도 씁니다). */
export const REPORT_TITLES: Record<ContestReport, string> = {
  participants: '참가자 현황',
  books: '도서 목록',
  journals: '일지 + 서평',
};

/** 내려받는 파일 이름에 쓰는 보고서 이름(기존 파일명 규칙: 제N회_이름.xlsx). */
export const REPORT_FILE_NAMES: Record<ContestReport, string> = {
  participants: '참가자현황',
  books: '도서목록',
  journals: '일지+서평',
};

export const MAX_REVIEW_UPLOAD_BYTES = 20 * 1024 * 1024;
export const INVALID_UPLOAD_MESSAGE = '20MB 이하의 .xlsx 파일을 선택해 주세요.';

/** 업로드 전 브라우저에서 확인하는 조건(기존 검증 그대로): .xlsx 확장자, 20MB 이하. */
export function isAcceptableReviewFile(file: Pick<File, 'name' | 'size'>) {
  return file.name.toLowerCase().endsWith('.xlsx') && file.size <= MAX_REVIEW_UPLOAD_BYTES;
}

/** 2026-12-02 → 2026.12.02 */
export function formatReportDate(date: string) {
  return date.slice(0, 10).replaceAll('-', '.');
}

export function reportFileName(roundNo: number, report: ContestReport) {
  return `제${roundNo}회_${REPORT_FILE_NAMES[report]}.xlsx`;
}

/**
 * 다운로드 실패를 원인별 문구로 바꿉니다. 인증(401)·권한(403)·네트워크·서버 오류를 같은 문구로 묶지 않습니다.
 * 입력값·파일·행사처럼 서버가 구체적으로 알려 준 4xx 오류는 서버 문구를 그대로 보여 줍니다.
 */
export function reportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '인증이 필요합니다. 로그인 상태를 확인해 주세요.';
    if (error.status === 403) return '해당 보고서를 다운로드할 권한이 없습니다.';
    if (error.code === 'NETWORK_ERROR') return error.message;
    if (error.code && error.status >= 400 && error.status < 500 && error.message)
      return error.message;
  }
  return '파일 생성에 실패했습니다. 다시 시도해 주세요.';
}

/** 다운로드를 시작한 뒤의 안내. 브라우저가 실제로 저장했는지는 알 수 없으므로 "시작"까지만 말합니다. */
export function reportSuccessFeedback(
  report: ContestReport,
  missingCallNumbers: number,
): ReportFeedback {
  if (report === 'books' && missingCallNumbers > 0) {
    return {
      tone: 'warning',
      text: `다운로드를 시작했습니다. 청구기호를 확인하지 못한 도서 ${missingCallNumbers.toLocaleString('ko-KR')}권은 목록 마지막에 있으니 확인해 주세요.`,
    };
  }
  return {
    tone: 'success',
    text: '다운로드를 시작했습니다. 브라우저의 다운로드 목록에서 파일을 확인해 주세요.',
  };
}

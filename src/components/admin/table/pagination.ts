/** 관리자 목록 페이지당 행 수: 기본 20건, 10·20·50건 중 선택 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** 행 수가 줄어 현재 페이지가 범위를 벗어나면 마지막 유효 페이지로 보정합니다. */
export function clampPage(page: number, total: number, pageSize: number) {
  return Math.min(Math.max(0, page), Math.max(0, Math.ceil(total / pageSize) - 1));
}

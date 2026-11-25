/**
 * 이전 주소를 통합된 화면의 탭 주소로 바꿉니다. 행사·요청 번호·목록 조건 같은 기존 쿼리는 그대로 넘기고,
 * 탭(view)만 지정한 값으로 덮어씁니다.
 */
export function legacyTabSearch(search: string, view: string) {
  const next = new URLSearchParams(search);
  next.delete('view');
  return `?${new URLSearchParams([['view', view], ...next]).toString()}`;
}

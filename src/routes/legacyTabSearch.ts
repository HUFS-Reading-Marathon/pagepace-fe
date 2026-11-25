/**
 * 이전 주소를 통합된 화면의 탭 주소로 바꿉니다. 행사·요청 번호·목록 조건 같은 기존 쿼리는 그대로 넘기고,
 * 탭(view)만 지정한 값으로 덮어씁니다.
 */
export function legacyTabSearch(search: string, view: string) {
  const next = new URLSearchParams(search);
  next.delete('view');
  return `?${new URLSearchParams([['view', view], ...next]).toString()}`;
}

/**
 * 사용자 도서 확인 요청(이전 /book-requests) 주소를 문의 게시판으로 옮깁니다.
 * 독서일지에서 넘긴 책 제목·ISBN이 있으면 도서 문의 작성 화면에 채우고, 없으면 도서 문의 목록을 엽니다.
 */
export function legacyBookRequestTarget(search: string) {
  const params = new URLSearchParams(search);
  const prefill = new URLSearchParams();
  for (const key of ['title', 'isbn']) {
    const value = params.get(key)?.trim();
    if (value) prefill.set(key, value);
  }
  return prefill.size ? `/inquiries/books/new?${prefill.toString()}` : `/inquiries?view=books`;
}

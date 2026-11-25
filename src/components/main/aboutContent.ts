/** 행사 소개 문구와 핵심 수치(메인페이지 행사 개요 카드와 행사안내 페이지가 같은 내용을 씁니다) */
export const ABOUT_SUMMARY =
  '읽은 쪽수를 거리로 환산해 누적하고, 선택한 코스의 목표 거리에 도달하면 완주로 인정합니다. 독서일지는 접수기간 안에 제출하며, 인정 여부는 도서관 기준에 따라 결정됩니다.';

export function aboutHighlights(courseCount: number): { title: string; caption: string }[] {
  return [
    { title: '1쪽 = 5m', caption: '독서량을 거리로 환산' },
    { title: '접수기간 내 제출', caption: '독서일지 접수기간에 기록 제출' },
    { title: `${courseCount}개 코스`, caption: '공개된 코스 중 선택' },
  ];
}

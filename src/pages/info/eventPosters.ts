/**
 * 행사(회차)별 공식 포스터. 행사안내 페이지의 행사 소개에서 원본 비율 그대로 보여 줍니다.
 *
 * 회차 번호(roundNo)로 고르는 이유: 행사 ID는 운영·개발 DB마다 다르지만 회차는 같은 행사를 가리킵니다.
 * 새 회차가 등록되면 그 회차의 포스터를 여기에 추가하기 전까지는 포스터 없이 소개만 보여,
 * 이전 회차 포스터가 잘못 노출되지 않습니다. (관리자 업로드 기능은 아직 없습니다.)
 */
export type EventPoster = {
  /** 화면 표시용(가로 640px) */
  display: string;
  /** 확대 보기용(원본 크기 WebP) */
  full: string;
  /** 원본 PNG(WebP를 지원하지 않는 브라우저용) */
  original: string;
  width: number;
  height: number;
  /** 포스터 속 문구를 그대로 옮긴 대체 텍스트 */
  alt: string;
};

const READING_MARATHON_POSTER: EventPoster = {
  display: '/posters/reading-marathon-poster-640.webp',
  full: '/posters/reading-marathon-poster.webp',
  original: '/posters/reading-marathon-poster.png',
  width: 1024,
  height: 1536,
  alt: '독서 마라톤 대회 공식 포스터. 책과 함께 달리는 더 특별한 여정! 한국외국어대학교 글로벌캠퍼스 도서관, 문의 031-330-4129.',
};

const POSTERS_BY_ROUND: Readonly<Record<number, EventPoster>> = {
  6: READING_MARATHON_POSTER,
};

/** 현재 행사 회차의 포스터. 등록되지 않은 회차면 null입니다. */
export function posterForRound(roundNo: number | null | undefined): EventPoster | null {
  return roundNo ? (POSTERS_BY_ROUND[roundNo] ?? null) : null;
}

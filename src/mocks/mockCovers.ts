/**
 * 목데이터 전용 책 표지(개발 서버 목데이터 모드 전용). src/mocks/covers/ 에 도서 제목과 같은 이름의
 * 이미지 파일을 두면 그 표지를 쓰고, 없으면 null을 돌려 기존 대체 표지가 보이게 합니다.
 * 운영 도서의 표지 조회(서버 도서 검색 API)와는 관계없습니다.
 */
const files = import.meta.glob('./covers/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const normalize = (value: string) => value.normalize('NFC').trim();

const byTitle = new Map(
  Object.entries(files).map(([path, url]) => [
    normalize(decodeURIComponent(path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''))),
    url,
  ]),
);

export function mockCoverUrl(title: string): string | null {
  return byTitle.get(normalize(title)) ?? null;
}

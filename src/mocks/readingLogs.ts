export type ReadingStatus = '인정' | '검토중' | '반려';
export type GenreKey = 'literature' | 'humanities' | 'society' | 'science' | 'art';

export type ReadingLog = {
  id: number;
  date: string;
  title: string;
  author: string;
  publisher: string;
  pages: number;
  status: ReadingStatus;
  genre: string;
  genreKey: GenreKey;
  memo: string;
};

export const selectedCourse = {
  name: '하프코스',
  targetDistance: 21100,
};

export const readingLogs: ReadingLog[] = [
  {
    id: 1,
    date: '2025-12-08',
    title: '아몬드',
    author: '손원평',
    publisher: '창비',
    pages: 120,
    status: '인정',
    genre: '문학',
    genreKey: 'literature',
    memo: '감정을 표현하지 못하는 인물의 성장 과정이 인상적이었다.',
  },
  {
    id: 2,
    date: '2025-12-10',
    title: '불편한 편의점',
    author: '김호연',
    publisher: '나무옆의자',
    pages: 95,
    status: '검토중',
    genre: '문학',
    genreKey: 'literature',
    memo: '가볍게 읽히지만 인물들의 사연이 따뜻하게 남았다.',
  },
  {
    id: 3,
    date: '2025-12-12',
    title: '지구 끝의 온실',
    author: '김초엽',
    publisher: '자이언트북스',
    pages: 140,
    status: '인정',
    genre: '과학',
    genreKey: 'science',
    memo: 'SF적 설정 안에서 인간적인 감정이 잘 드러나는 점이 좋았다.',
  },
  {
    id: 4,
    date: '2025-12-15',
    title: '모순',
    author: '양귀자',
    publisher: '쓰다',
    pages: 180,
    status: '인정',
    genre: '문학',
    genreKey: 'literature',
    memo: '삶의 선택과 모순을 담담하게 보여주는 문장이 오래 남았다.',
  },
  {
    id: 5,
    date: '2025-12-18',
    title: '공정하다는 착각',
    author: '마이클 샌델',
    publisher: '와이즈베리',
    pages: 160,
    status: '검토중',
    genre: '사회',
    genreKey: 'society',
    memo: '능력주의와 공정에 대해 다시 생각하게 된 책.',
  },
  {
    id: 6,
    date: '2025-12-20',
    title: '방구석 미술관',
    author: '조원재',
    publisher: '블랙피쉬',
    pages: 110,
    status: '인정',
    genre: '예술',
    genreKey: 'art',
    memo: '작품을 시대적 배경과 함께 이해할 수 있어 흥미로웠다.',
  },
];
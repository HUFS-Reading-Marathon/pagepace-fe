export type DepartmentGroup = {
  label: string;
  departments: readonly string[];
};

// 글로벌캠퍼스 학부 소속 목록
// 기준: 2026 대학생활 길라잡이 '학과(부) 사무실 전화번호(글로벌캠퍼스)' 표,
//       한국외대 홈페이지 대학/대학원 > 글로벌캠퍼스 단과대학 안내
// 신입생 모집이 중지됐더라도 재학생이 남아 있는 학과(통번역대학, 국제지역대학 등)는 유지한다.
export const STUDENT_DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    label: '인문대학',
    departments: ['철학과', '사학과', '언어인지과학과'],
  },
  {
    label: '통번역대학',
    departments: [
      '영어통번역학부',
      '독일어통번역학과',
      '스페인어통번역학과',
      '이탈리아어통번역학과',
      '중국어통번역학과',
      '일본어통번역학과',
      '말레이·인도네시아어통번역학과',
      '태국어통번역학과',
    ],
  },
  {
    label: '국가전략언어대학',
    departments: [
      '폴란드학과',
      '루마니아학과',
      '체코·슬로바키아학과',
      '헝가리학과',
      '세르비아·크로아티아학과',
      '그리스·불가리아학과',
      '중앙아시아학과',
      '아프리카학부',
      '우크라이나학과',
      '한국학과',
      '국가전략언어계열',
    ],
  },
  {
    label: '국제지역대학',
    departments: ['프랑스학과', '브라질학과', '인도학과', '러시아학과'],
  },
  {
    label: '경상대학',
    departments: ['Global Business & Technology학부', '국제금융학과'],
  },
  {
    label: '자연과학대학',
    departments: ['수학과', '통계학과', '전자물리학과', '환경학과', '생명공학과', '화학과'],
  },
  {
    label: '공과대학',
    departments: [
      '컴퓨터공학부',
      '정보통신공학과',
      '반도체전자공학부(반도체공학전공)',
      '반도체전자공학부(전자공학전공)',
      '산업경영공학과',
    ],
  },
  { label: '융합인재대학', departments: ['융합인재학부'] },
  {
    label: 'Culture & Technology융합대학',
    departments: ['디지털콘텐츠학부', '투어리즘 & 웰니스학부', '글로벌스포츠산업학부'],
  },
  { label: 'AI융합대학', departments: ['AI데이터융합학부', 'Finance & AI융합학부'] },
  {
    label: '독립학부',
    departments: ['바이오메디컬공학부', '기후변화융합학부', '자유전공학부(글로벌)'],
  },
] as const;

export const GENERAL_AFFILIATIONS = [
  '대학원',
  '교원',
  '도서관',
  '행정부서',
  '연구기관',
  '기타 소속',
] as const;

export function isKnownDepartment(value: string) {
  return (
    STUDENT_DEPARTMENT_GROUPS.some((group) => group.departments.includes(value)) ||
    GENERAL_AFFILIATIONS.includes(value as (typeof GENERAL_AFFILIATIONS)[number])
  );
}

// 학과명으로 소속 단과대학 그룹을 찾습니다. 목록에 없으면 undefined를 돌려줍니다.
export function findDepartmentGroup(value: string) {
  return STUDENT_DEPARTMENT_GROUPS.find((group) => group.departments.includes(value));
}

// 현재 목록에 없는 기존 저장 소속(과거 학과명 등)을 선택지에 그대로 보여주기 위한 값
export function getUnlistedDepartment(value: string) {
  const trimmed = value.trim();
  return trimmed && !isKnownDepartment(value) ? value : null;
}

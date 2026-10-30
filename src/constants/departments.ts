export type DepartmentGroup = {
  label: string;
  departments: readonly string[];
};

export const STUDENT_DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    label: '국가전략언어대학',
    departments: [
      '그리스·불가리아학과',
      '중앙아시아학과',
      '아프리카학부',
      '한국학과',
      '폴란드학과',
      '루마니아학과',
      '체코·슬로바키아학과',
      '헝가리학과',
      '세르비아·크로아티아학과',
      '우크라이나학과',
      '국가전략언어계열',
    ],
  },
  {
    label: '공과대학',
    departments: [
      '컴퓨터공학부',
      '정보통신공학과',
      '반도체전자공학부(반도체공학전공)',
      '반도체전자공학부(전자공학전공)',
      '산업경영공학과',
      '디지털콘텐츠학부',
    ],
  },
  { label: 'AI융합대학', departments: ['AI데이터융합학부', 'Finance & AI융합학부'] },
  { label: '융합인재대학', departments: ['융합인재학부'] },
  {
    label: 'Culture & Technology융합대학',
    departments: ['투어리즘 & 웰니스학부', '글로벌스포츠산업학부'],
  },
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

import {
  GENERAL_AFFILIATIONS,
  STUDENT_DEPARTMENT_GROUPS,
  findDepartmentGroup,
  type DepartmentGroup,
} from '../../constants/departments';

/** 학부생 외 신분에서 함께 고를 수 있는 일반 소속 묶음 (값은 GENERAL_AFFILIATIONS 그대로) */
export const GENERAL_GROUP: DepartmentGroup = {
  label: '교직원·대학원·기타',
  departments: GENERAL_AFFILIATIONS,
};

/** 현재 목록에 없는 기존 저장값을 보존할 때 첫 번째 선택에 쓰는 내부 키 (서버로 전송하지 않음) */
export const LEGACY_COLLEGE_KEY = '__legacy__';

/** 첫 번째 선택(단과대학·소속 구분)에 보여 줄 묶음. 학과 목록과 순서는 원본 그대로입니다. */
export function getDepartmentGroups(includeGeneral: boolean): readonly DepartmentGroup[] {
  return includeGeneral ? [...STUDENT_DEPARTMENT_GROUPS, GENERAL_GROUP] : STUDENT_DEPARTMENT_GROUPS;
}

/** 저장된 학과명으로 첫 번째 선택 값을 찾습니다. 목록에 없는 기존 값은 보존용 키를 돌려줍니다. */
export function getCollegeOf(value: string) {
  if (!value.trim()) return '';
  if (GENERAL_GROUP.departments.includes(value)) return GENERAL_GROUP.label;
  return findDepartmentGroup(value)?.label ?? LEGACY_COLLEGE_KEY;
}

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  GENERAL_AFFILIATIONS,
  STUDENT_DEPARTMENT_GROUPS,
  findDepartmentGroup,
  getUnlistedDepartment,
  isKnownDepartment,
} from '../src/constants/departments';
import DepartmentSelect from '../src/components/forms/DepartmentSelect';
import {
  GENERAL_GROUP,
  LEGACY_COLLEGE_KEY,
  getCollegeOf,
  getDepartmentGroups,
} from '../src/components/forms/departmentSelectOptions';
import ApplyPage from '../src/pages/auth/ApplyPage';
import AccountSettingsPage from '../src/pages/my/AccountSettingsPage';

const LEGACY_DEPARTMENT = '아랍어통번역학과';

// 계정 설정 화면이 서버에서 받아 온 기존 소속을 가진 상태를 정적 렌더링으로 재현한다.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initial: unknown) =>
      actual.useState(
        initial && typeof initial === 'object' && 'department' in initial
          ? { ...initial, department: LEGACY_DEPARTMENT }
          : initial,
      )) as typeof actual.useState,
  };
});
vi.mock('../src/auth', () => ({ useAuth: () => ({ logout: () => undefined }) }));

const allDepartments = STUDENT_DEPARTMENT_GROUPS.flatMap((group) => group.departments);
const departmentsOf = (label: string) =>
  STUDENT_DEPARTMENT_GROUPS.find((group) => group.label === label)?.departments ?? [];

describe('글로벌캠퍼스 학과 목록', () => {
  it('2026 공식 자료의 단과대학별 학과를 모두 포함한다', () => {
    expect(departmentsOf('인문대학')).toEqual(['철학과', '사학과', '언어인지과학과']);
    expect(departmentsOf('통번역대학')).toEqual([
      '영어통번역학부',
      '독일어통번역학과',
      '스페인어통번역학과',
      '이탈리아어통번역학과',
      '중국어통번역학과',
      '일본어통번역학과',
      '말레이·인도네시아어통번역학과',
      '태국어통번역학과',
    ]);
    expect(departmentsOf('국제지역대학')).toEqual([
      '프랑스학과',
      '브라질학과',
      '인도학과',
      '러시아학과',
    ]);
    expect(departmentsOf('경상대학')).toEqual(['Global Business & Technology학부', '국제금융학과']);
    expect(departmentsOf('자연과학대학')).toEqual([
      '수학과',
      '통계학과',
      '전자물리학과',
      '환경학과',
      '생명공학과',
      '화학과',
    ]);
    expect(allDepartments).toHaveLength(48);
  });

  it('디지털콘텐츠학부는 공과대학이 아니라 Culture & Technology융합대학에 속한다', () => {
    expect(departmentsOf('Culture & Technology융합대학')).toContain('디지털콘텐츠학부');
    expect(departmentsOf('공과대학')).not.toContain('디지털콘텐츠학부');
  });

  it('학과와 단과대학 이름이 중복되지 않는다', () => {
    expect(new Set(allDepartments).size).toBe(allDepartments.length);
    const labels = STUDENT_DEPARTMENT_GROUPS.map((group) => group.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(allDepartments.filter((name) => name !== name.trim())).toEqual([]);
    expect(GENERAL_AFFILIATIONS.filter((name) => allDepartments.includes(name))).toEqual([]);
  });

  it('서울캠퍼스·송도캠퍼스 전용 학과는 포함하지 않는다', () => {
    for (const name of [
      'ELLT학과',
      '영어통번역학과',
      '프랑스어학부',
      '경영학부',
      'Language & AI융합학부',
      '자유전공학부(서울)',
      '글로벌바이오 & 비즈니스융합학부',
      '외국인자유전공학부',
    ]) {
      expect(isKnownDepartment(name)).toBe(false);
    }
  });

  it('목록에 없는 기존 저장 소속만 별도 선택지로 돌려준다', () => {
    expect(getUnlistedDepartment(LEGACY_DEPARTMENT)).toBe(LEGACY_DEPARTMENT);
    expect(getUnlistedDepartment('철학과')).toBeNull();
    expect(getUnlistedDepartment('교원')).toBeNull();
    expect(getUnlistedDepartment('')).toBeNull();
    expect(getUnlistedDepartment('  ')).toBeNull();
  });
});

describe('단과대학 → 학과 2단계 선택 로직', () => {
  it('저장된 학과명으로 단과대학을 찾고, 목록에 없는 값은 보존용 키로 구분한다', () => {
    expect(getCollegeOf('컴퓨터공학부')).toBe('공과대학');
    expect(getCollegeOf('철학과')).toBe('인문대학');
    expect(getCollegeOf('교원')).toBe(GENERAL_GROUP.label);
    expect(getCollegeOf(LEGACY_DEPARTMENT)).toBe(LEGACY_COLLEGE_KEY);
    expect(getCollegeOf('')).toBe('');
    expect(findDepartmentGroup('컴퓨터공학부')?.label).toBe('공과대학');
    expect(findDepartmentGroup(LEGACY_DEPARTMENT)).toBeUndefined();
  });

  it('선택지 묶음은 원본 학과 목록과 순서를 그대로 쓰고, 일반 소속은 필요할 때만 뒤에 붙인다', () => {
    expect(getDepartmentGroups(false)).toBe(STUDENT_DEPARTMENT_GROUPS);
    const withGeneral = getDepartmentGroups(true);
    expect(withGeneral.slice(0, -1)).toEqual([...STUDENT_DEPARTMENT_GROUPS]);
    expect(withGeneral.at(-1)?.departments).toBe(GENERAL_AFFILIATIONS);
  });
});

describe('학과 선택 화면', () => {
  it('참가신청 화면은 단과대학을 먼저 고르고, 그 전에는 학과 선택을 비활성화한다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ApplyPage />
      </MemoryRouter>,
    );
    for (const group of STUDENT_DEPARTMENT_GROUPS) {
      expect(html).toContain(`<option value="${group.label.replace(/&/g, '&amp;')}">`);
    }
    // 학부생(기본 신분)에게는 일반 소속 묶음을 보여 주지 않는다
    expect(html).not.toContain(GENERAL_GROUP.label);
    expect(html).toMatch(/<select id="department" disabled="">/);
    expect(html).toContain('단과대학 먼저 선택');
    expect(html).not.toContain('<option value="철학과">');
  });

  it('선택된 학과가 있으면 해당 단과대학의 학과만 보여 준다', () => {
    const html = renderToStaticMarkup(
      <DepartmentSelect
        idPrefix="test"
        value="컴퓨터공학부"
        onChange={() => undefined}
        includeGeneral={false}
        collegeLabel="단과대학"
        departmentLabel="소속 학과"
      />,
    );
    expect(html).toContain('<option value="공과대학" selected="">공과대학</option>');
    expect(html).toContain('<option value="컴퓨터공학부" selected="">컴퓨터공학부</option>');
    for (const name of departmentsOf('공과대학')) expect(html).toContain(`<option value="${name}"`);
    expect(html).not.toContain('<option value="철학과"');
  });

  it('일반 소속 값은 교직원·대학원·기타 묶음으로 복원한다', () => {
    const html = renderToStaticMarkup(
      <DepartmentSelect
        idPrefix="test"
        value="교원"
        onChange={() => undefined}
        includeGeneral
        collegeLabel="소속 구분"
        departmentLabel="소속"
      />,
    );
    expect(html).toContain(`<option value="${GENERAL_GROUP.label}" selected="">`);
    expect(html).toContain('<option value="교원" selected="">교원</option>');
  });

  it('계정 설정 화면은 목록에 없는 기존 저장 학과명을 그대로 선택된 상태로 보여준다', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    );
    expect(html).toContain(`<option value="${LEGACY_COLLEGE_KEY}" selected="">기존 소속</option>`);
    expect(html).toContain(
      `<option value="${LEGACY_DEPARTMENT}" selected="">${LEGACY_DEPARTMENT}</option>`,
    );
    expect(html).toContain('<option value="자연과학대학">자연과학대학</option>');
    expect(html).toContain(`<option value="${GENERAL_GROUP.label}">`);
  });
});

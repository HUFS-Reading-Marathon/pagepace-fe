import { useState } from 'react';
import {
  LEGACY_COLLEGE_KEY as LEGACY_KEY,
  getCollegeOf,
  getDepartmentGroups,
} from './departmentSelectOptions';
import './department-select.css';

type DepartmentSelectProps = {
  /** 선택 상자 id 접두어. `${idPrefix}College`, `${idPrefix}` 두 id를 만듭니다. */
  idPrefix: string;
  /** 서버에 저장·전송하는 학과(소속) 문자열. 기존 값 그대로 사용합니다. */
  value: string;
  onChange: (department: string) => void;
  /** 교직원·대학원·기타 소속도 선택지에 포함할지 여부 */
  includeGeneral: boolean;
  collegeLabel: string;
  departmentLabel: string;
  /** 각 칸을 감싸는 화면별 클래스(예: auth-form-group) */
  fieldClassName?: string;
};

/**
 * 단과대학 → 학과 2단계 선택.
 * 전송 값은 기존과 같은 학과명 문자열 하나이며, 단과대학은 화면에서 목록을 좁히는 용도로만 씁니다.
 */
function DepartmentSelect({
  idPrefix,
  value,
  onChange,
  includeGeneral,
  collegeLabel,
  departmentLabel,
  fieldClassName = '',
}: DepartmentSelectProps) {
  const [college, setCollege] = useState(() => getCollegeOf(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // 서버 값이 늦게 도착하는 등 바깥에서 학과가 바뀌면 단과대학 선택을 그 값에 맞춥니다.
  // 빈 값(신분 변경 등으로 초기화)일 때는 사용자가 고른 단과대학을 그대로 둡니다.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value.trim()) setCollege(getCollegeOf(value));
    else if (college === LEGACY_KEY) setCollege('');
  }

  const groups = getDepartmentGroups(includeGeneral);
  const isLegacy = college === LEGACY_KEY;
  const selectedGroup = groups.find((group) => group.label === college);
  // 신분이 바뀌어 더 이상 고를 수 없는 묶음이면 선택하지 않은 상태로 봅니다.
  const effectiveCollege = isLegacy || selectedGroup ? college : '';
  const collegeId = `${idPrefix}College`;

  const handleCollegeChange = (nextCollege: string) => {
    setCollege(nextCollege);
    // 단과대학을 바꾸면 이전 학과 선택은 초기화합니다.
    onChange('');
  };

  return (
    <div className="department-select">
      <div className={`department-select__field ${fieldClassName}`.trim()}>
        <label htmlFor={collegeId}>{collegeLabel}</label>
        <select
          id={collegeId}
          value={effectiveCollege}
          onChange={(event) => handleCollegeChange(event.target.value)}
        >
          <option value="" disabled>
            선택해 주세요
          </option>
          {isLegacy && <option value={LEGACY_KEY}>기존 소속</option>}
          {groups.map((group) => (
            <option key={group.label} value={group.label}>
              {group.label}
            </option>
          ))}
        </select>
      </div>

      <div className={`department-select__field ${fieldClassName}`.trim()}>
        <label htmlFor={idPrefix}>{departmentLabel}</label>
        <select
          id={idPrefix}
          value={effectiveCollege ? value : ''}
          disabled={!effectiveCollege}
          // 좁은 칸에서 긴 학과명이 말줄임될 때 전체 이름을 확인할 수 있게 합니다.
          title={effectiveCollege && value ? value : undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            {effectiveCollege ? '선택해 주세요' : `${collegeLabel} 먼저 선택`}
          </option>
          {isLegacy && value && <option value={value}>{value}</option>}
          {selectedGroup?.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default DepartmentSelect;

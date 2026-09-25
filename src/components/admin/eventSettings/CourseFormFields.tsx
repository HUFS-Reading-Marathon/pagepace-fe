import {
  formatCourseNumber,
  getRewardTypeLabel,
  REWARD_TYPE_OPTIONS,
  type CourseForm,
} from '../../../utils/adminEventForms';

type CourseFormFieldsProps = {
  form: CourseForm;
  updateField: (field: keyof CourseForm, value: string) => void;
  disabled?: boolean;
};

/**
 * 코스 표(기존 코스 수정·새 코스 생성 행)에서 공통으로 쓰는 셀 묶음입니다.
 * 열 제목은 표의 <th>가 담당하므로, 각 입력은 aria-label로 접근성 레이블을 갖습니다.
 * disabled(조회 모드)일 때는 input 대신 값을 읽기 쉬운 텍스트로 보여줍니다.
 */
function CourseFormFields({ form, updateField, disabled = false }: CourseFormFieldsProps) {
  const isKnownRewardType = REWARD_TYPE_OPTIONS.some((option) => option.value === form.rewardType);

  if (disabled) {
    return (
      <>
        <td className="admin-event-settings__course-table-name">{form.name || '-'}</td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.targetDistanceMeter)} m
        </td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.standardBookCount)} 권
        </td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.avgMonthlyReadingCount)}
        </td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.maxWinners)}
        </td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.extraLoanCount)}
        </td>
        <td>{getRewardTypeLabel(form.rewardType) || '-'}</td>
        <td className="admin-event-settings__course-table-number">
          {formatCourseNumber(form.rewardAmount)}원
        </td>
      </>
    );
  }

  return (
    <>
      <td className="admin-event-settings__course-table-name">
        <input
          type="text"
          required
          aria-label="코스명"
          placeholder="예: 단축 코스"
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
      </td>

      <td>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            aria-label="목표 거리(m)"
            value={form.targetDistanceMeter}
            onChange={(event) => updateField('targetDistanceMeter', event.target.value)}
          />
          <span>m</span>
        </div>
      </td>

      <td>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            aria-label="기준 도서 수(권)"
            value={form.standardBookCount}
            onChange={(event) => updateField('standardBookCount', event.target.value)}
          />
          <span>권</span>
        </div>
      </td>

      <td>
        <input
          type="number"
          min="0"
          step="1"
          aria-label="월평균 독서량"
          value={form.avgMonthlyReadingCount}
          onChange={(event) => updateField('avgMonthlyReadingCount', event.target.value)}
        />
      </td>

      <td>
        <input
          type="number"
          min="0"
          step="1"
          aria-label="최대 수상자"
          value={form.maxWinners}
          onChange={(event) => updateField('maxWinners', event.target.value)}
        />
      </td>

      <td>
        <input
          type="number"
          min="0"
          step="1"
          aria-label="추가 대출 권수"
          value={form.extraLoanCount}
          onChange={(event) => updateField('extraLoanCount', event.target.value)}
        />
      </td>

      <td>
        <select
          aria-label="보상 유형"
          required
          value={form.rewardType}
          onChange={(event) => updateField('rewardType', event.target.value)}
        >
          <option value="">보상 유형 선택</option>
          {!isKnownRewardType && form.rewardType && (
            <option value={form.rewardType} disabled>
              지원하지 않는 기존 값 ({form.rewardType})
            </option>
          )}
          {REWARD_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>

      <td>
        <input
          type="number"
          min="0"
          step="1"
          aria-label="보상 금액"
          value={form.rewardAmount}
          onChange={(event) => updateField('rewardAmount', event.target.value)}
        />
      </td>
    </>
  );
}

export default CourseFormFields;

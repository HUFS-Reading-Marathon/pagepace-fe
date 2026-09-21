import { REWARD_TYPE_OPTIONS, type CourseForm } from '../../../utils/adminEventForms';

type CourseFormFieldsProps = {
  form: CourseForm;
  updateField: (field: keyof CourseForm, value: string) => void;
};

/** 코스 카드(기존 코스 수정·새 코스 생성)에서 공통으로 쓰는 입력 필드 묶음 */
function CourseFormFields({ form, updateField }: CourseFormFieldsProps) {
  const isKnownRewardType = REWARD_TYPE_OPTIONS.some((option) => option.value === form.rewardType);

  return (
    <div className="admin-event-settings__course-fields">
      <label className="admin-event-settings__course-name">
        <span>코스명</span>
        <input
          type="text"
          required
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
      </label>

      <label>
        <span>목표 거리</span>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.targetDistanceMeter}
            onChange={(event) => updateField('targetDistanceMeter', event.target.value)}
          />
          <span>m</span>
        </div>
      </label>

      <label>
        <span>기준 도서 수</span>
        <div className="admin-event-settings__number-control">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.standardBookCount}
            onChange={(event) => updateField('standardBookCount', event.target.value)}
          />
          <span>권</span>
        </div>
      </label>

      <label>
        <span>월평균 독서량</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.avgMonthlyReadingCount}
          onChange={(event) => updateField('avgMonthlyReadingCount', event.target.value)}
        />
      </label>

      <label>
        <span>최대 수상자</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.maxWinners}
          onChange={(event) => updateField('maxWinners', event.target.value)}
        />
      </label>

      <label>
        <span>추가 대출 권수</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.extraLoanCount}
          onChange={(event) => updateField('extraLoanCount', event.target.value)}
        />
      </label>

      <label>
        <span>보상 유형</span>
        <select
          value={form.rewardType}
          required
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
      </label>

      <label>
        <span>보상 금액</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.rewardAmount}
          onChange={(event) => updateField('rewardAmount', event.target.value)}
        />
      </label>

      <label>
        <span>표시 순서</span>
        <input
          type="number"
          min="0"
          step="1"
          value={form.displayOrder}
          onChange={(event) => updateField('displayOrder', event.target.value)}
        />
      </label>
    </div>
  );
}

export default CourseFormFields;

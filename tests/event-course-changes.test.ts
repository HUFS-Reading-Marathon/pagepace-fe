import { describe, expect, it } from 'vitest';
import { COURSE_PRESETS, getCourseFormChanges } from '../src/utils/adminEventForms';

const short = { courseId: 1, form: { ...COURSE_PRESETS.SHORT } };
const half = { courseId: 2, form: { ...COURSE_PRESETS.HALF } };

describe('코스 변경 확인', () => {
  it('추가와 삭제를 저장 전 확인 목록에 표시한다', () => {
    expect(getCourseFormChanges([short], [short, half])).toMatchObject([
      { label: '코스 추가', after: half.form.name },
    ]);
    expect(getCourseFormChanges([short, half], [short])).toMatchObject([
      { label: '코스 삭제', before: half.form.name },
    ]);
  });

  it('추가 후 삭제하거나 변경 값을 원복하면 확인 목록이 비워진다', () => {
    const changed = { ...short, form: { ...short.form, rewardAmount: '99999' } };
    expect(getCourseFormChanges([short], [changed])).toHaveLength(1);
    expect(getCourseFormChanges([short], [{ ...changed, form: { ...short.form } }])).toEqual([]);
    expect(
      getCourseFormChanges(
        [short],
        [short, half].filter((course) => course.courseId !== 2),
      ),
    ).toEqual([]);
  });

  it('내용 변경과 표시 순서 변경을 함께 감지한다', () => {
    const result = getCourseFormChanges(
      [short, half],
      [
        { ...half, form: { ...half.form, displayOrder: '1' } },
        { ...short, form: { ...short.form, displayOrder: '2', name: '새 코스명' } },
      ],
    );
    expect(result.filter((change) => change.label === '표시 순서')).toHaveLength(2);
    expect(result.some((change) => change.label === '코스명')).toBe(true);
  });
});

/**
 * 관리자 업무 목록의 컬럼별 정렬 공통 규칙(참가자 관리·독서일지 검토와 같은 방식).
 * - 같은 컬럼을 다시 누르면 오름차순↔내림차순, 다른 컬럼을 누르면 그 컬럼 오름차순
 * - 화면에 보이는 문자열(예: "1,075m", "96쪽")이 아니라 실제 값으로 비교
 * - 값이 없는 행은 정렬 방향과 관계없이 항상 마지막
 * - 값이 같으면 호출한 쪽의 보조 기준(기본 순서·고유 ID)으로 순서를 고정
 */
export type SortDirection = 'ascending' | 'descending';
export type SortState<Column extends string> = { column: Column; direction: SortDirection };

export function nextSort<Column extends string>(
  current: SortState<Column>,
  column: Column,
): SortState<Column> {
  return {
    column,
    direction:
      current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

/** URL에 담는 정렬 방향 (asc/desc) */
export const directionParam = (direction: SortDirection) =>
  direction === 'descending' ? 'desc' : 'asc';
export const readDirection = (value: string | null): SortDirection =>
  value === 'desc' ? 'descending' : 'ascending';

/** 한글·영문·숫자가 섞인 이름·제목은 자연 정렬(“도서2” < “도서10”). 학번·ISBN처럼 앞자리 0이 있는 식별자도 문자열 그대로 둡니다. */
const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

export type SortValue = string | number | null | undefined;

const isMissing = (value: SortValue) =>
  value === null || value === undefined || value === '' || Number.isNaN(value);

/** 값 하나 비교(방향 미적용). 숫자는 크기로, 문자열은 자연 정렬로 비교합니다. */
export function compareValues(left: SortValue, right: SortValue) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return collator.compare(String(left), String(right));
}

/**
 * 방향을 적용해 비교합니다. 값이 없는 쪽은 방향과 관계없이 뒤로 보내고, 둘 다 없거나 같으면 0을 돌려
 * 호출한 쪽이 보조 기준을 쓰게 합니다.
 */
export function compareBy(left: SortValue, right: SortValue, direction: SortDirection) {
  const leftMissing = isMissing(left);
  const rightMissing = isMissing(right);
  if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
  return (direction === 'ascending' ? 1 : -1) * compareValues(left, right);
}

/** 날짜·시간 문자열을 시각(ms)으로 바꿉니다. 형식이 달라도 같은 기준으로 비교하고, 해석할 수 없으면 null입니다. */
export function timeValue(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(time) ? null : time;
}

/** 상태처럼 업무상 순서가 정해진 값의 순위. 목록에 없는 값은 null(마지막)입니다. */
export function orderValue<Value extends string>(order: readonly Value[], value: Value) {
  const index = order.indexOf(value);
  return index < 0 ? null : index;
}

/**
 * 정렬 키 함수로 행을 정렬합니다(원본 배열은 바꾸지 않음). tieBreak로 같은 값의 순서를 고정합니다.
 */
export function sortRows<Row, Column extends string>(
  rows: readonly Row[],
  sort: SortState<Column>,
  valueOf: (row: Row, column: Column) => SortValue,
  tieBreak: (left: Row, right: Row) => number,
) {
  return [...rows].sort(
    (left, right) =>
      compareBy(valueOf(left, sort.column), valueOf(right, sort.column), sort.direction) ||
      tieBreak(left, right),
  );
}

import type { SortDirection } from './sorting';

type Props = {
  label: string;
  /** 이 컬럼이 현재 정렬 기준이면 방향, 아니면 undefined */
  direction: SortDirection | undefined;
  disabled?: boolean;
  onSort: () => void;
};

/**
 * 정렬 가능한 컬럼 제목 버튼. 참가자 관리 표와 같은 모양(roster-sort, 회색 화살표, 활성 컬럼 네이비)을 씁니다.
 * 활성 표시와 aria-sort는 감싸는 <th aria-sort={direction}>에 둡니다(admin-participants.css).
 */
export default function SortHeaderButton({ label, direction, disabled = false, onSort }: Props) {
  return (
    <button
      type="button"
      className="roster-sort"
      disabled={disabled}
      title={`${label} ${direction === 'ascending' ? '내림차순' : '오름차순'} 정렬`}
      onClick={onSort}
    >
      {label}
      <span className="sort-mark" aria-hidden="true" />
    </button>
  );
}

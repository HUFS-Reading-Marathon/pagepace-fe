import { PAGE_SIZE_OPTIONS } from './pagination';

type Props = {
  total: number;
  page: number;
  pageSize: number;
  busy?: boolean;
  /** 페이지 이동 영역의 접근성 이름 (예: "일지 페이지") */
  label: string;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
};

/** 관리자 목록 하단: 현재 범위 / 전체 건수, 페이지 번호, 페이지당 행 수 */
export default function TablePagination({
  total,
  page,
  pageSize,
  busy = false,
  label,
  onPage,
  onPageSize,
}: Props) {
  const pageCount = Math.ceil(total / pageSize);
  const firstPage = Math.max(0, Math.min(page - 2, pageCount - 5));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => firstPage + i);
  const start = page * pageSize;
  return (
    <footer className="roster-footer">
      <span aria-live="polite">
        {total
          ? `${(start + 1).toLocaleString()}–${Math.min(total, start + pageSize).toLocaleString()}`
          : '0'}{' '}
        / {total.toLocaleString()}건
      </span>
      <nav className="roster-pagination" aria-label={label}>
        <button
          type="button"
          aria-label="이전 페이지"
          disabled={!page || busy}
          onClick={() => onPage(page - 1)}
        >
          이전
        </button>
        {pageNumbers.map((n) => (
          <button
            type="button"
            key={n}
            aria-label={`${n + 1}페이지`}
            aria-current={n === page ? 'page' : undefined}
            disabled={busy}
            onClick={() => onPage(n)}
          >
            {n + 1}
          </button>
        ))}
        <button
          type="button"
          aria-label="다음 페이지"
          disabled={page + 1 >= pageCount || busy}
          onClick={() => onPage(page + 1)}
        >
          다음
        </button>
      </nav>
      {onPageSize && (
        <select
          aria-label="페이지당 행 수"
          value={pageSize}
          disabled={busy}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}건씩 보기
            </option>
          ))}
        </select>
      )}
    </footer>
  );
}

import {
  READING_LOG_REVIEW_OPTIONS,
  READING_LOG_STATUS_OPTIONS,
  type ReadingLogReviewFilter,
  type ReadingLogStatusFilter,
} from '../../../types/adminReadingLog';

type ReadingLogFiltersProps = {
  searchKeyword: string;
  statusFilter: ReadingLogStatusFilter;
  reviewFilter: ReadingLogReviewFilter;
  dateFilter: string;
  resultCount: number;
  totalCount: number;
  onSearchKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: ReadingLogStatusFilter) => void;
  onReviewFilterChange: (value: ReadingLogReviewFilter) => void;
  onDateFilterChange: (value: string) => void;
  onReset: () => void;
};

function ReadingLogFilters({
  searchKeyword,
  statusFilter,
  reviewFilter,
  dateFilter,
  resultCount,
  totalCount,
  onSearchKeywordChange,
  onStatusFilterChange,
  onReviewFilterChange,
  onDateFilterChange,
  onReset,
}: ReadingLogFiltersProps) {
  return (
    <section
      className="admin-reading-logs__toolbar"
      aria-label="독서일지 검색 및 필터"
    >
      <div className="admin-reading-logs__filters">
        <div className="admin-reading-logs__field admin-reading-logs__field--search">
          <label htmlFor="readingLogSearch">통합 검색</label>
          <input
            id="readingLogSearch"
            type="search"
            value={searchKeyword}
            placeholder="참가자, 학번, 책 제목, 저자, 출판사"
            onChange={(event) => onSearchKeywordChange(event.target.value)}
          />
        </div>

        <div className="admin-reading-logs__field">
          <label htmlFor="readingLogStatusFilter">상태</label>
          <select
            id="readingLogStatusFilter"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as ReadingLogStatusFilter,
              )
            }
          >
            {READING_LOG_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-reading-logs__field">
          <label htmlFor="readingLogReviewFilter">자동 검증</label>
          <select
            id="readingLogReviewFilter"
            value={reviewFilter}
            onChange={(event) =>
              onReviewFilterChange(
                event.target.value as ReadingLogReviewFilter,
              )
            }
          >
            {READING_LOG_REVIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-reading-logs__field">
          <label htmlFor="readingLogDateFilter">독서 날짜</label>
          <input
            id="readingLogDateFilter"
            type="date"
            value={dateFilter}
            onChange={(event) => onDateFilterChange(event.target.value)}
          />
        </div>
      </div>

      <div className="admin-reading-logs__toolbar-footer">
        <p className="admin-reading-logs__result">
          전체 {totalCount.toLocaleString('ko-KR')}건 중{' '}
          <strong>{resultCount.toLocaleString('ko-KR')}건</strong>
        </p>
        <button
          type="button"
          className="admin-reading-logs__button"
          onClick={onReset}
        >
          검색·필터 초기화
        </button>
      </div>
    </section>
  );
}

export default ReadingLogFilters;


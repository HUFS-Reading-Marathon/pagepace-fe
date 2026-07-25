import {
  STATUS_ACTIVITY_FILTER_OPTIONS,
  STATUS_COMPLETION_FILTER_OPTIONS,
  STATUS_COURSE_FILTER_OPTIONS,
  STATUS_SORT_OPTIONS,
  type StatusActivityFilter,
  type StatusCompletionFilter,
  type StatusCourseFilter,
  type StatusSortOption,
} from '../../../types/adminStatus';

type StatusFiltersProps = {
  searchKeyword: string;
  courseFilter: StatusCourseFilter;
  completionFilter: StatusCompletionFilter;
  activityFilter: StatusActivityFilter;
  sortOption: StatusSortOption;
  resultCount: number;
  totalCount: number;
  onSearchKeywordChange: (value: string) => void;
  onCourseFilterChange: (value: StatusCourseFilter) => void;
  onCompletionFilterChange: (value: StatusCompletionFilter) => void;
  onActivityFilterChange: (value: StatusActivityFilter) => void;
  onSortOptionChange: (value: StatusSortOption) => void;
  onReset: () => void;
};

function StatusFilters({
  searchKeyword,
  courseFilter,
  completionFilter,
  activityFilter,
  sortOption,
  resultCount,
  totalCount,
  onSearchKeywordChange,
  onCourseFilterChange,
  onCompletionFilterChange,
  onActivityFilterChange,
  onSortOptionChange,
  onReset,
}: StatusFiltersProps) {
  return (
    <section className="admin-status__filters" aria-label="현황 검색 및 필터">
      <div className="admin-status__filter-grid">
        <div className="admin-status__field admin-status__field--search">
          <label htmlFor="statusSearch">통합 검색</label>
          <input
            id="statusSearch"
            type="search"
            value={searchKeyword}
            placeholder="참가자 이름 또는 학번"
            onChange={(event) => onSearchKeywordChange(event.target.value)}
          />
        </div>

        <div className="admin-status__field">
          <label htmlFor="statusCourseFilter">코스</label>
          <select
            id="statusCourseFilter"
            value={courseFilter}
            onChange={(event) =>
              onCourseFilterChange(
                event.target.value as StatusCourseFilter,
              )
            }
          >
            {STATUS_COURSE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-status__field">
          <label htmlFor="statusCompletionFilter">완주 상태</label>
          <select
            id="statusCompletionFilter"
            value={completionFilter}
            onChange={(event) =>
              onCompletionFilterChange(
                event.target.value as StatusCompletionFilter,
              )
            }
          >
            {STATUS_COMPLETION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-status__field">
          <label htmlFor="statusActivityFilter">당일 독서</label>
          <select
            id="statusActivityFilter"
            value={activityFilter}
            onChange={(event) =>
              onActivityFilterChange(
                event.target.value as StatusActivityFilter,
              )
            }
          >
            {STATUS_ACTIVITY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-status__field">
          <label htmlFor="statusSortOption">정렬</label>
          <select
            id="statusSortOption"
            value={sortOption}
            onChange={(event) =>
              onSortOptionChange(event.target.value as StatusSortOption)
            }
          >
            {STATUS_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-status__filter-footer">
        <p>
          현재 <strong>{resultCount}명</strong> / 전체 {totalCount}명
        </p>
        <button type="button" onClick={onReset}>
          검색·필터 초기화
        </button>
      </div>
    </section>
  );
}

export default StatusFilters;


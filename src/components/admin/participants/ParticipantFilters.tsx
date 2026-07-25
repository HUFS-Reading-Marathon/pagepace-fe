import {
  AFFILIATION_OPTIONS,
  COURSE_OPTIONS,
  PARTICIPANT_STATUS_OPTIONS,
  type ParticipantAffiliationFilter,
  type ParticipantCourseFilter,
  type ParticipantStatusFilter,
} from '../../../types/adminParticipant';

type ParticipantFiltersProps = {
  searchKeyword: string;
  statusFilter: ParticipantStatusFilter;
  courseFilter: ParticipantCourseFilter;
  affiliationFilter: ParticipantAffiliationFilter;
  resultCount: number;
  onSearchKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: ParticipantStatusFilter) => void;
  onCourseFilterChange: (value: ParticipantCourseFilter) => void;
  onAffiliationFilterChange: (
    value: ParticipantAffiliationFilter,
  ) => void;
  onReset: () => void;
  onDownload: () => void;
};

function ParticipantFilters({
  searchKeyword,
  statusFilter,
  courseFilter,
  affiliationFilter,
  resultCount,
  onSearchKeywordChange,
  onStatusFilterChange,
  onCourseFilterChange,
  onAffiliationFilterChange,
  onReset,
  onDownload,
}: ParticipantFiltersProps) {
  return (
    <section
      className="admin-participants__toolbar"
      aria-label="참가자 검색 및 필터"
    >
      <div className="admin-participants__filter-grid">
        <div className="admin-participants__field admin-participants__search">
          <label htmlFor="participantSearch">통합 검색</label>
          <input
            id="participantSearch"
            type="search"
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder="이름, 학번/사번, 이메일"
          />
        </div>

        <div className="admin-participants__field">
          <label htmlFor="participantStatusFilter">신청 상태</label>
          <select
            id="participantStatusFilter"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as ParticipantStatusFilter,
              )
            }
          >
            <option value="ALL">전체</option>
            {PARTICIPANT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-participants__field">
          <label htmlFor="participantCourseFilter">참가 코스</label>
          <select
            id="participantCourseFilter"
            value={courseFilter}
            onChange={(event) =>
              onCourseFilterChange(
                event.target.value as ParticipantCourseFilter,
              )
            }
          >
            <option value="ALL">전체</option>
            {COURSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-participants__field">
          <label htmlFor="participantAffiliationFilter">신분</label>
          <select
            id="participantAffiliationFilter"
            value={affiliationFilter}
            onChange={(event) =>
              onAffiliationFilterChange(
                event.target.value as ParticipantAffiliationFilter,
              )
            }
          >
            <option value="ALL">전체</option>
            {AFFILIATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-participants__toolbar-footer">
        <p
          className="admin-participants__result-count"
          aria-live="polite"
        >
          검색 결과 <strong>{resultCount}</strong>명
        </p>

        <div className="admin-participants__toolbar-actions">
          <button
            type="button"
            className="admin-participants__button admin-participants__button--secondary"
            onClick={onReset}
          >
            초기화
          </button>
          <button
            type="button"
            className="admin-participants__button admin-participants__button--primary"
            onClick={onDownload}
            disabled={resultCount === 0}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>
    </section>
  );
}

export default ParticipantFilters;

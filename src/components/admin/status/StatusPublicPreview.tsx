import { useMemo } from 'react';
import {
  STATUS_COURSE_FILTER_OPTIONS,
  type ParticipantStatusRow,
  type StatusCourseFilter,
  type StatusVisibilitySettings,
} from '../../../types/adminStatus';
import {
  formatStatusDate,
  formatStatusDistance,
  maskParticipantName,
} from '../../../utils/statusAggregation';

type StatusPublicPreviewProps = {
  baseDate: string;
  participants: ParticipantStatusRow[];
  settings: StatusVisibilitySettings;
  isPublic: boolean;
  hasUnpublishedChanges: boolean;
  courseFilter: StatusCourseFilter;
  onCourseFilterChange: (value: StatusCourseFilter) => void;
};

function StatusPublicPreview({
  baseDate,
  participants,
  settings,
  isPublic,
  hasUnpublishedChanges,
  courseFilter,
  onCourseFilterChange,
}: StatusPublicPreviewProps) {
  const previewRows = useMemo(
    () =>
      participants.filter(
        (participant) =>
          courseFilter === 'ALL' || participant.courseId === courseFilter,
      ),
    [courseFilter, participants],
  );

  return (
    <div className="admin-status__public-preview">
      <header className="admin-status__preview-header">
        <div>
          <p>독서마라톤</p>
          <h3>대회 현황</h3>
          <span>기준 날짜 {formatStatusDate(baseDate)}</span>
        </div>
        <div className="admin-status__preview-badges">
          <span>{isPublic ? '공개 설정 미리보기' : '비공개 설정 미리보기'}</span>
          {hasUnpublishedChanges && <span>미공개 변경사항</span>}
        </div>
      </header>

      <div
        className="admin-status__preview-tabs"
        role="group"
        aria-label="미리보기 코스 선택"
      >
        {STATUS_COURSE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={courseFilter === option.value}
            onClick={() => onCourseFilterChange(option.value)}
          >
            {option.label.replace(' 코스', '')}
          </button>
        ))}
      </div>

      {previewRows.length === 0 ? (
        <div className="admin-status__preview-empty">
          미리보기에 표시할 참가자가 없습니다.
        </div>
      ) : (
        <div className="admin-status__public-table-wrapper">
          <table className="admin-status__public-table">
            <thead>
              <tr>
                {settings.showRanks && <th scope="col">순위</th>}
                <th scope="col">이름</th>
                <th scope="col">코스</th>
                <th scope="col">누적 페이지</th>
                <th scope="col">누적 거리</th>
                <th scope="col">달성률</th>
                <th scope="col">완주</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((participant) => (
                <tr key={participant.participantId}>
                  {settings.showRanks && (
                    <td>{participant.courseRank}위</td>
                  )}
                  <td className="admin-status__public-name">
                    {settings.maskNames
                      ? maskParticipantName(participant.name)
                      : participant.name}
                  </td>
                  <td>{participant.courseName}</td>
                  <td>
                    {participant.cumulativePages.toLocaleString('ko-KR')}쪽
                  </td>
                  <td>
                    {formatStatusDistance(
                      participant.cumulativeDistanceMeters,
                    )}
                  </td>
                  <td>{participant.progressRate.toFixed(1)}%</td>
                  <td>
                    {participant.isCompleted ? (
                      <span className="admin-status__public-complete">
                        완주
                        {participant.courseId === 'full' && (
                          <small>FULL</small>
                        )}
                      </span>
                    ) : (
                      '진행 중'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StatusPublicPreview;


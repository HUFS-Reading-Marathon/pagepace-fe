import { Link } from 'react-router-dom';
import type { StatusCourseSummary } from '../../../types/adminStatus';

type DashboardCourseCompletionProps = {
  summaries: StatusCourseSummary[];
};

function DashboardCourseCompletion({
  summaries,
}: DashboardCourseCompletionProps) {
  const totalParticipants = summaries.reduce(
    (sum, summary) => sum + summary.participantCount,
    0,
  );
  const totalCompleted = summaries.reduce(
    (sum, summary) => sum + summary.completedCount,
    0,
  );

  return (
    <section className="admin-dashboard__card admin-dashboard__course-progress admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>코스별 완주 현황</h2>
        <strong>
          {totalCompleted} / {totalParticipants}명
        </strong>
      </header>

      <div className="admin-dashboard__course-list">
        {summaries.map((summary) => {
          const completionRate =
            summary.participantCount > 0
              ? (summary.completedCount / summary.participantCount) * 100
              : 0;

          return (
            <div
              className="admin-dashboard__course-item"
              key={summary.courseId}
            >
              <div className="admin-dashboard__course-heading">
                <strong>{summary.courseName}</strong>
                <div>
                  <strong>
                    {summary.completedCount} / {summary.participantCount}명
                  </strong>
                  {summary.participantCount === 0 && (
                    <span>참가자 없음</span>
                  )}
                </div>
              </div>
              <div className="admin-dashboard__progress-row">
                <progress
                  max="100"
                  value={Math.min(completionRate, 100)}
                  aria-label={`${summary.courseName} 완주율 ${completionRate.toFixed(
                    1,
                  )}%`}
                />
                <strong>{completionRate.toFixed(1)}%</strong>
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/admin/status" className="admin-dashboard__card-link">
        전체 현황 보기
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export default DashboardCourseCompletion;

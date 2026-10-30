import type { AdminCompetitionCourseSummary as CourseSummary } from '../../../types/adminStatus';
import { formatStatusDistance } from '../../../utils/statusAggregation';

type StatusCourseSummaryProps = {
  summaries: CourseSummary[];
};

function StatusCourseSummary({ summaries }: StatusCourseSummaryProps) {
  return (
    <section className="admin-status__course-summary" aria-labelledby="statusCourseSummaryTitle">
      <div className="admin-status__section-heading">
        <div>
          <h2 id="statusCourseSummaryTitle">코스별 요약</h2>
          <p>현재 누적 승인 쪽수와 서평 인정 거리를 코스별로 집계했습니다.</p>
        </div>
      </div>

      <div className="admin-status__course-summary-wrapper">
        <table>
          <thead>
            <tr>
              <th scope="col">코스</th>
              <th scope="col">참가자</th>
              <th scope="col">완주자</th>
              <th scope="col">평균 달성률</th>
              <th scope="col">누적 페이지</th>
              <th scope="col">누적 거리</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.courseId}>
                <th scope="row">{summary.courseName}</th>
                <td>{summary.participantCount}명</td>
                <td>
                  {summary.completedCount === null ? '판정 미지원' : `${summary.completedCount}명`}
                </td>
                <td>
                  {summary.averageProgressRate === null
                    ? '—'
                    : `${summary.averageProgressRate.toFixed(1)}%`}
                </td>
                <td>{summary.totalPages.toLocaleString('ko-KR')}쪽</td>
                <td>{formatStatusDistance(summary.totalDistanceMeters)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default StatusCourseSummary;

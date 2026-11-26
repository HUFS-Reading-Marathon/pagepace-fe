import type { DashboardDistributionItem } from '../../../utils/dashboardAnalytics';
import DashboardEmptyState from './DashboardEmptyState';

type DashboardAffiliationChartProps = {
  distribution: DashboardDistributionItem[];
  participantCount: number;
  /** 실제 행사 상태(빈 상태 문구를 시작 전·진행 중·종료로 나눕니다) */
  eventStatus?: string | null;
};

function DashboardAffiliationChart({
  distribution,
  participantCount,
  eventStatus,
}: DashboardAffiliationChartProps) {
  return (
    <section className="admin-dashboard__card admin-dashboard__affiliation admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>참가자 소속 분포</h2>
      </header>

      {participantCount === 0 ? (
        <DashboardEmptyState kind="affiliation" eventStatus={eventStatus} />
      ) : (
        <figure
          className="admin-dashboard__affiliation-figure"
          aria-label={`승인 참가자 ${participantCount}명의 소속 분포`}
        >
          <div className="admin-dashboard__affiliation-list">
            {distribution.map((item) => (
              <div key={item.label}>
                <div className="admin-dashboard__affiliation-label">
                  <span title={item.label}>{item.label}</span>
                  <strong>
                    {item.count}명 · {item.rate.toFixed(1)}%
                  </strong>
                </div>
                <progress
                  max={participantCount}
                  value={item.count}
                  aria-label={`${item.label} ${item.count}명, ${item.rate.toFixed(1)}%`}
                />
              </div>
            ))}
          </div>
        </figure>
      )}
    </section>
  );
}

export default DashboardAffiliationChart;

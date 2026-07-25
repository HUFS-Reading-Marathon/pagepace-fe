import type { DashboardDistributionItem } from '../../../utils/dashboardAnalytics';

type DashboardAffiliationChartProps = {
  distribution: DashboardDistributionItem[];
  participantCount: number;
};

function DashboardAffiliationChart({
  distribution,
  participantCount,
}: DashboardAffiliationChartProps) {
  return (
    <section className="admin-dashboard__card admin-dashboard__affiliation admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>참가자 소속 분포</h2>
      </header>

      {participantCount === 0 ? (
        <div className="admin-dashboard__empty">
          승인 참가자의 소속 정보가 없습니다.
        </div>
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
                  aria-label={`${item.label} ${item.count}명, ${item.rate.toFixed(
                    1,
                  )}%`}
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

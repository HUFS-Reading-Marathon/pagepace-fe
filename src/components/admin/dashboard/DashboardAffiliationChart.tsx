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
        <div>
          <h2>참가자 소속 분포</h2>
          <p>승인 참가자의 신청서 소속 값을 그대로 집계했습니다.</p>
        </div>
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
          <figcaption>
            소속 미입력과 상위 항목 외 인원도 전체 합계에 포함됩니다.
          </figcaption>
        </figure>
      )}
    </section>
  );
}

export default DashboardAffiliationChart;

import type { DashboardDistributionItem } from '../../../utils/dashboardAnalytics';

type DashboardGenderChartProps = {
  distribution: DashboardDistributionItem[];
  participantCount: number;
};

function DashboardGenderChart({
  distribution,
  participantCount,
}: DashboardGenderChartProps) {
  const segments = distribution.map((item, index) => ({
    ...item,
    offset: distribution
      .slice(0, index)
      .reduce((sum, previousItem) => sum + previousItem.rate, 0),
  }));

  return (
    <section className="admin-dashboard__card admin-dashboard__demographics admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <div>
          <h2>참가자 성별 분포</h2>
          <p>승인 참가자 기준이며 개인 정보는 표시하지 않습니다.</p>
        </div>
      </header>

      {participantCount === 0 ? (
        <div className="admin-dashboard__empty">
          승인 참가자의 성별 정보가 없습니다.
        </div>
      ) : (
        <figure
          className="admin-dashboard__donut-figure"
          aria-label={`승인 참가자 ${participantCount}명의 성별 분포`}
        >
          <div className="admin-dashboard__donut">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle
                className="admin-dashboard__donut-track"
                cx="50"
                cy="50"
                r="36"
                pathLength="100"
              />
              {segments.map((item, index) => (
                <circle
                  key={item.label}
                  className={`admin-dashboard__donut-segment admin-dashboard__donut-segment--${
                    index % 6
                  }`}
                  cx="50"
                  cy="50"
                  r="36"
                  pathLength="100"
                  strokeDasharray={`${item.rate} ${100 - item.rate}`}
                  strokeDashoffset={-item.offset}
                />
              ))}
            </svg>
            <div>
              <strong>{participantCount}</strong>
              <span>승인 참가자</span>
            </div>
          </div>

          <figcaption className="admin-dashboard__chart-legend">
            {distribution.map((item, index) => (
              <div key={item.label}>
                <span
                  className={`admin-dashboard__legend-mark admin-dashboard__legend-mark--${
                    index % 6
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                <strong>
                  {item.count}명 · {item.rate.toFixed(1)}%
                </strong>
              </div>
            ))}
          </figcaption>
        </figure>
      )}
    </section>
  );
}

export default DashboardGenderChart;

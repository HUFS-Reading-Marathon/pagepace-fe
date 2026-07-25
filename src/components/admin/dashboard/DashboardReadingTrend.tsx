import { useMemo, useState } from 'react';
import type { AdminReadingLog } from '../../../types/adminReadingLog';
import {
  getDailyActivity,
  type DashboardDailyActivity,
} from '../../../utils/dashboardAnalytics';

type TrendPeriod = 7 | 14 | 30;
type TrendMetric = 'approvedPages' | 'submissionCount';

type DashboardReadingTrendProps = {
  logs: ReadonlyArray<AdminReadingLog>;
  now: Date;
};

const PERIOD_OPTIONS: ReadonlyArray<{
  value: TrendPeriod;
  label: string;
}> = [
  { value: 7, label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
];

const METRIC_OPTIONS: ReadonlyArray<{
  value: TrendMetric;
  label: string;
  unit: string;
}> = [
  { value: 'approvedPages', label: '승인 페이지', unit: '쪽' },
  { value: 'submissionCount', label: '제출 건수', unit: '건' },
];

function getMetricValue(
  activity: DashboardDailyActivity,
  metric: TrendMetric,
) {
  return activity[metric];
}

function DashboardReadingTrend({
  logs,
  now,
}: DashboardReadingTrendProps) {
  const [period, setPeriod] = useState<TrendPeriod>(7);
  const [metric, setMetric] =
    useState<TrendMetric>('approvedPages');
  const activities = useMemo(
    () => getDailyActivity(logs, period, now),
    [logs, now, period],
  );
  const selectedMetric =
    METRIC_OPTIONS.find((option) => option.value === metric) ??
    METRIC_OPTIONS[0];
  const values = activities.map((activity) =>
    getMetricValue(activity, metric),
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = activities.length > 0 ? total / activities.length : 0;
  const maximumValue = Math.max(0, ...values);
  const chartMaximum = maximumValue > 0 ? maximumValue : 1;
  const plotLeft = 44;
  const plotTop = 18;
  const plotWidth = 660;
  const plotHeight = 180;
  const plotBottom = plotTop + plotHeight;
  const slotWidth = plotWidth / activities.length;
  const barWidth = Math.max(4, slotWidth * 0.62);
  const labelInterval = period === 7 ? 1 : period === 14 ? 2 : 5;

  return (
    <section className="admin-dashboard__card admin-dashboard__trend admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <div>
          <h2>최근 독서 활동</h2>
          <p>독서 날짜와 제출 시각을 기준으로 일별 활동을 집계합니다.</p>
        </div>
        <div className="admin-dashboard__trend-controls">
          <div role="group" aria-label="독서 활동 지표">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={metric === option.value}
                onClick={() => setMetric(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="독서 활동 기간">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <figure
        className="admin-dashboard__trend-figure"
        aria-label={`${selectedMetric.label} 최근 ${period}일 막대그래프`}
      >
        <svg
          viewBox="0 0 720 244"
          role="img"
          aria-labelledby="dashboardTrendTitle dashboardTrendDescription"
        >
          <title id="dashboardTrendTitle">
            최근 {period}일 {selectedMetric.label}
          </title>
          <desc id="dashboardTrendDescription">
            총 {total.toLocaleString('ko-KR')}
            {selectedMetric.unit}, 일평균 {average.toFixed(1)}
            {selectedMetric.unit}입니다.
          </desc>

          {[0, 0.5, 1].map((ratio) => {
            const y = plotBottom - plotHeight * ratio;
            const labelValue = Math.round(maximumValue * ratio);

            return (
              <g key={ratio}>
                <line
                  className="admin-dashboard__chart-grid"
                  x1={plotLeft}
                  x2={plotLeft + plotWidth}
                  y1={y}
                  y2={y}
                />
                <text
                  className="admin-dashboard__chart-axis"
                  x={plotLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {labelValue.toLocaleString('ko-KR')}
                </text>
              </g>
            );
          })}

          {activities.map((activity, index) => {
            const value = getMetricValue(activity, metric);
            const height = (value / chartMaximum) * plotHeight;
            const x =
              plotLeft + slotWidth * index + (slotWidth - barWidth) / 2;
            const y = plotBottom - height;
            const showLabel =
              index % labelInterval === 0 ||
              index === activities.length - 1;

            return (
              <g
                key={activity.date}
                className="admin-dashboard__trend-point"
                tabIndex={0}
                role="img"
                aria-label={`${activity.date}, ${selectedMetric.label} ${value.toLocaleString(
                  'ko-KR',
                )}${selectedMetric.unit}`}
              >
                <title>
                  {activity.date}: {value.toLocaleString('ko-KR')}
                  {selectedMetric.unit}
                </title>
                <rect
                  x={x}
                  y={height > 0 ? y : plotBottom - 1}
                  width={barWidth}
                  height={Math.max(1, height)}
                  rx="2"
                />
                {showLabel && (
                  <text
                    className="admin-dashboard__chart-axis"
                    x={x + barWidth / 2}
                    y={plotBottom + 22}
                    textAnchor="middle"
                  >
                    {activity.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {total === 0 && (
          <div className="admin-dashboard__chart-empty">
            선택 기간에 집계된 독서 활동이 없습니다.
          </div>
        )}

        <figcaption>
          <span>
            최근 {period}일 합계{' '}
            <strong>
              {total.toLocaleString('ko-KR')}
              {selectedMetric.unit}
            </strong>
          </span>
          <span>
            하루 평균{' '}
            <strong>
              {average.toLocaleString('ko-KR', {
                maximumFractionDigits: 1,
              })}
              {selectedMetric.unit}
            </strong>
          </span>
        </figcaption>

        <table className="sr-only">
          <caption>
            최근 {period}일 {selectedMetric.label} 데이터
          </caption>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">{selectedMetric.label}</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.date}>
                <th scope="row">{activity.date}</th>
                <td>
                  {getMetricValue(activity, metric)}
                  {selectedMetric.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </section>
  );
}

export default DashboardReadingTrend;

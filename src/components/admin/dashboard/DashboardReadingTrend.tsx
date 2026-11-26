import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AdminReadingLogResponse } from '../../../types/adminReadingLogApi';
import { getDailyActivity, type DashboardDailyActivity } from '../../../utils/dashboardAnalytics';
import DashboardEmptyState from './DashboardEmptyState';

type TrendPeriod = 7 | 14 | 30;
type TrendMetric = 'approvedPages' | 'submissionCount';

type DashboardReadingTrendProps = {
  logs: ReadonlyArray<AdminReadingLogResponse>;
  now: Date;
  /** 실제 행사 상태(활동이 없을 때 안내 문구를 시작 전·진행 중·종료로 나눕니다) */
  eventStatus?: string | null;
};

const PERIOD_OPTIONS: ReadonlyArray<{
  value: TrendPeriod;
  label: string;
  ariaLabel: string;
}> = [
  { value: 7, label: '7일', ariaLabel: '최근 7일' },
  { value: 14, label: '14일', ariaLabel: '최근 14일' },
  { value: 30, label: '30일', ariaLabel: '최근 30일' },
];

const METRIC_OPTIONS: ReadonlyArray<{
  value: TrendMetric;
  label: string;
  unit: string;
}> = [
  { value: 'approvedPages', label: '승인 페이지', unit: '쪽' },
  { value: 'submissionCount', label: '제출 건수', unit: '건' },
];

function SlidingPillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; ariaLabel?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator) return;

    const update = () => {
      const selected = group.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!selected) return;
      indicator.style.width = `${selected.offsetWidth}px`;
      indicator.style.height = `${selected.offsetHeight}px`;
      indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
      indicator.style.visibility = 'visible';
    };

    indicator.style.transition = positioned.current ? '' : 'none';
    update();
    positioned.current = true;

    const observer = new ResizeObserver(update);
    observer.observe(group);
    group.querySelectorAll('button').forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={groupRef} className="admin-dashboard__sliding-pill" role="group" aria-label={label}>
      <span ref={indicatorRef} className="admin-dashboard__pill-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function getMetricValue(activity: DashboardDailyActivity, metric: TrendMetric) {
  return activity[metric];
}

function DashboardReadingTrend({ logs, now, eventStatus }: DashboardReadingTrendProps) {
  const [period, setPeriod] = useState<TrendPeriod>(7);
  const [metric, setMetric] = useState<TrendMetric>('approvedPages');
  const activities = useMemo(() => getDailyActivity(logs, period, now), [logs, now, period]);
  const selectedMetric =
    METRIC_OPTIONS.find((option) => option.value === metric) ?? METRIC_OPTIONS[0];
  const values = activities.map((activity) => getMetricValue(activity, metric));
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = activities.length > 0 ? total / activities.length : 0;
  const maximumValue = Math.max(0, ...values);
  const chartMaximum = maximumValue > 0 ? maximumValue : 1;
  const plotLeft = 44;
  const plotTop = 18;
  const plotWidth = 660;
  const plotHeight = 140;
  const plotBottom = plotTop + plotHeight;
  const slotWidth = plotWidth / activities.length;
  const barWidth = Math.max(5, slotWidth * 0.68);
  const labelInterval = period === 7 ? 1 : period === 14 ? 2 : 5;

  return (
    <section className="admin-dashboard__card admin-dashboard__trend admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>최근 독서 활동</h2>
        <div className="admin-dashboard__trend-controls">
          <SlidingPillGroup
            label="독서 활동 지표"
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
          />
          <SlidingPillGroup
            label="독서 활동 기간"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
          />
        </div>
      </header>

      {total === 0 ? (
        // 선택한 지표·기간에 활동이 없으면 빈 차트 대신 안내를 가운데에 보여 줍니다.
        <DashboardEmptyState kind="trend" eventStatus={eventStatus} />
      ) : (
        <figure
          className="admin-dashboard__trend-figure"
          aria-label={`${selectedMetric.label} 최근 ${period}일 막대그래프`}
        >
          <svg
            viewBox="0 0 720 196"
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
              const x = plotLeft + slotWidth * index + (slotWidth - barWidth) / 2;
              const y = plotBottom - height;
              const showLabel = index % labelInterval === 0 || index === activities.length - 1;

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

          <figcaption>
            최근 {period}일{' '}
            <strong>
              {total.toLocaleString('ko-KR')}
              {selectedMetric.unit}
            </strong>
            <span aria-hidden="true">·</span>
            하루 평균{' '}
            <strong>
              {average.toLocaleString('ko-KR', {
                maximumFractionDigits: 1,
              })}
              {selectedMetric.unit}
            </strong>
          </figcaption>

          <div className="sr-only">
            <table>
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
          </div>
        </figure>
      )}
    </section>
  );
}

export default DashboardReadingTrend;

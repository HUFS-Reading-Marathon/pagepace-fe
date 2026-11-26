import { Link } from 'react-router-dom';

type DashboardMetricCardProps = {
  label: string;
  value: number | null;
  unit: string;
  description: string;
  to: string;
  /** 이동할 화면 이름(보이는 링크 대신 스크린 리더 안내에 씁니다) */
  linkLabel: string;
  tone: 'navy' | 'green' | 'blue' | 'gold' | 'teal';
};

/** 같은 세트의 라인 아이콘(24px 격자, 1.6 선 굵기, 둥근 끝) */
function MetricIcon({ tone }: Pick<DashboardMetricCardProps, 'tone'>) {
  if (tone === 'green') {
    // 승인 참가자: 체크 표시가 있는 사용자
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10" cy="8" r="3.2" />
        <path d="M4 19.5c0-3.4 2.7-5.6 6-5.6 1.3 0 2.5.3 3.5.9" />
        <path d="m14.5 17.5 2 2 4-4.5" />
      </svg>
    );
  }

  if (tone === 'blue') {
    // 오늘 제출: 문서
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l4 4v13H7z" />
        <path d="M14 3.5v4h4" />
        <path d="M9.8 12.5h5.4M9.8 16h5.4" />
      </svg>
    );
  }

  if (tone === 'gold') {
    // 검토 대기: 시계
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }

  if (tone === 'teal') {
    // 총 완주자: 트로피
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3" />
        <path d="M12 13v3.5M9 20h6M10 16.5h4" />
      </svg>
    );
  }

  // 총 신청자: 그룹
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M16.5 14c2.7 0 4.5 1.7 4.5 4.5" />
    </svg>
  );
}

/** 요약 카드: 카드 전체가 링크입니다(이동 화면은 to). */
function DashboardMetricCard({
  label,
  value,
  unit,
  description,
  to,
  linkLabel,
  tone,
}: DashboardMetricCardProps) {
  const valueText = value === null ? '집계 중' : `${value.toLocaleString('ko-KR')}${unit}`;

  return (
    <Link
      to={to}
      className={`admin-dashboard__metric admin-dashboard__metric--${tone} admin-dashboard__enter`}
      aria-label={`${label} ${valueText}, ${description}. ${linkLabel} 화면으로 이동`}
    >
      <div className="admin-dashboard__metric-heading">
        <span>{label}</span>
        <span className="admin-dashboard__metric-icon">
          <MetricIcon tone={tone} />
        </span>
      </div>
      <p className="admin-dashboard__metric-value">
        <strong>{value === null ? '—' : value.toLocaleString('ko-KR')}</strong>
        {value !== null && <span>{unit}</span>}
      </p>
      <p className="admin-dashboard__metric-description">{description}</p>
    </Link>
  );
}

export default DashboardMetricCard;

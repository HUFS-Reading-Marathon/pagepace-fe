import { Link } from 'react-router-dom';

type DashboardMetricCardProps = {
  label: string;
  value: number;
  unit: string;
  description: string;
  to: string;
  linkLabel: string;
  tone: 'navy' | 'green' | 'blue' | 'gold' | 'teal';
};

function MetricIcon({
  tone,
}: Pick<DashboardMetricCardProps, 'tone'>) {
  if (tone === 'green') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7.5 12 3 3 6-7" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  if (tone === 'blue') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.5h10v15H7zM9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </svg>
    );
  }

  if (tone === 'gold') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8v4l2.5 1.5" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  if (tone === 'teal') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m8 12 2.5 2.5L16 9" />
        <path d="M5 4.5h14v15H5z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.5" />
      <path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14 15c3.2 0 5.1 1.3 5.7 4" />
    </svg>
  );
}

function DashboardMetricCard({
  label,
  value,
  unit,
  description,
  to,
  linkLabel,
  tone,
}: DashboardMetricCardProps) {
  return (
    <article
      className={`admin-dashboard__metric admin-dashboard__metric--${tone} admin-dashboard__enter`}
    >
      <div className="admin-dashboard__metric-heading">
        <span>{label}</span>
        <span className="admin-dashboard__metric-icon">
          <MetricIcon tone={tone} />
        </span>
      </div>
      <p className="admin-dashboard__metric-value">
        <strong>{value.toLocaleString('ko-KR')}</strong>
        <span>{unit}</span>
      </p>
      <p className="admin-dashboard__metric-description">{description}</p>
      <Link to={to} className="admin-dashboard__card-link">
        {linkLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export default DashboardMetricCard;

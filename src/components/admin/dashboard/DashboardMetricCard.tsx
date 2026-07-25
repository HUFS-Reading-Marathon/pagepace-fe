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
        <span className="admin-dashboard__metric-mark" aria-hidden="true" />
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

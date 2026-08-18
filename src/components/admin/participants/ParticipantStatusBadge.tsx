import {
  ADMIN_APPLICATION_STATUS_LABELS,
  type AdminApplicationStatus,
} from '../../../types/adminApplication';

type ParticipantStatusBadgeProps = {
  status: AdminApplicationStatus;
};

const STATUS_CLASS_NAMES: Record<AdminApplicationStatus, string> = {
  APPLIED: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

function ParticipantStatusBadge({ status }: ParticipantStatusBadgeProps) {
  return (
    <span
      className={[
        'admin-participant-status',
        `admin-participant-status--${STATUS_CLASS_NAMES[status]}`,
      ].join(' ')}
    >
      {ADMIN_APPLICATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default ParticipantStatusBadge;

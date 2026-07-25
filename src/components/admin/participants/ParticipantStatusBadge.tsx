import {
  PARTICIPANT_STATUS_LABELS,
  type ParticipantApplicationStatus,
} from '../../../types/adminParticipant';

type ParticipantStatusBadgeProps = {
  status: ParticipantApplicationStatus;
};

const STATUS_CLASS_NAMES: Record<ParticipantApplicationStatus, string> = {
  PENDING: 'pending',
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
      {PARTICIPANT_STATUS_LABELS[status]}
    </span>
  );
}

export default ParticipantStatusBadge;

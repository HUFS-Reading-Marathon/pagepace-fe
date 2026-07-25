import {
  READING_LOG_STATUS_LABELS,
  type ReadingLogStatus,
} from '../../../types/adminReadingLog';

type ReadingLogStatusBadgeProps = {
  status: ReadingLogStatus;
};

function ReadingLogStatusBadge({ status }: ReadingLogStatusBadgeProps) {
  return (
    <span
      className={`admin-reading-log-status admin-reading-log-status--${status}`}
    >
      {READING_LOG_STATUS_LABELS[status]}
    </span>
  );
}

export default ReadingLogStatusBadge;


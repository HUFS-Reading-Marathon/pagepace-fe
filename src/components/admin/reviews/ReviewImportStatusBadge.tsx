import {
  REVIEW_IMPORT_STATUS_LABELS,
  type ReviewImportStatus,
} from '../../../types/adminReviewImport';

type ReviewImportStatusBadgeProps = {
  status: ReviewImportStatus;
};

function ReviewImportStatusBadge({ status }: ReviewImportStatusBadgeProps) {
  return (
    <span
      className={`admin-review-status admin-review-status--${status.toLowerCase().replace('_', '-')}`}
    >
      {REVIEW_IMPORT_STATUS_LABELS[status]}
    </span>
  );
}

export default ReviewImportStatusBadge;

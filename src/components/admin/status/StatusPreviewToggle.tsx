import type {
  ParticipantStatusRow,
  StatusCourseFilter,
  StatusVisibilitySettings,
} from '../../../types/adminStatus';
import { formatStatusDate } from '../../../utils/statusAggregation';
import StatusPublicPreview from './StatusPublicPreview';

type StatusPreviewToggleProps = {
  isOpen: boolean;
  baseDate: string;
  participants: ParticipantStatusRow[];
  settings: StatusVisibilitySettings;
  isPublic: boolean;
  hasUnpublishedChanges: boolean;
  courseFilter: StatusCourseFilter;
  onToggle: () => void;
  onCourseFilterChange: (value: StatusCourseFilter) => void;
};

function StatusPreviewToggle({
  isOpen,
  baseDate,
  participants,
  settings,
  isPublic,
  hasUnpublishedChanges,
  courseFilter,
  onToggle,
  onCourseFilterChange,
}: StatusPreviewToggleProps) {
  return (
    <section className="admin-status__preview">
      <button
        type="button"
        className="admin-status__preview-toggle"
        aria-expanded={isOpen}
        aria-controls="status-preview-panel"
        onClick={onToggle}
      >
        <span>
          <strong>공개 화면 미리보기</strong>
          <small>
            {formatStatusDate(baseDate)} ·{' '}
            {isPublic ? '공개 중' : '비공개'} · 이름{' '}
            {settings.maskNames ? '마스킹' : '원문'} · 순위{' '}
            {settings.showRanks ? '공개' : '비공개'}
          </small>
        </span>
        <span aria-hidden="true">{isOpen ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>

      {isOpen && (
        <div id="status-preview-panel" className="admin-status__preview-panel">
          <StatusPublicPreview
            baseDate={baseDate}
            participants={participants}
            settings={settings}
            isPublic={isPublic}
            hasUnpublishedChanges={hasUnpublishedChanges}
            courseFilter={courseFilter}
            onCourseFilterChange={onCourseFilterChange}
          />
        </div>
      )}
    </section>
  );
}

export default StatusPreviewToggle;


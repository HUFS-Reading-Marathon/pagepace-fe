import {
  EVENT_STATUS_LABELS,
  isManualEventStatus,
  type EventStatus,
} from '../../../types/adminEvent';

type Tone = 'green' | 'blue' | 'gray';

/** 진행 중은 초록, 신청 접수 중은 파랑, 그 밖(준비·신청 마감·종료·작성 중·확정·보관)은 회색 */
function toneOf(status: EventStatus | null): Tone {
  if (status === 'IN_PROGRESS') return 'green';
  if (status === 'APPLICATION_OPEN') return 'blue';
  return 'gray';
}

/** 서버가 알려 준 상태에 맞는 안내(백엔드 정책: 작성 중·최종 확정·보관만 수동 관리) */
function noteOf(status: EventStatus | null) {
  switch (status) {
    case 'DRAFT':
      return '공개하면 준비 상태가 되고, 이후에는 설정한 행사 기간에 따라 자동 변경됩니다.';
    case 'FINALIZED':
      return '최종 확정된 행사입니다. 기록은 더 이상 변경할 수 없습니다.';
    case 'ARCHIVED':
      return '보관된 행사입니다. 다시 열 수 없습니다.';
    default:
      return '설정한 행사 기간에 따라 자동 변경됩니다.';
  }
}

/**
 * 행사 운영 상태 표시: 상태 표시등 + 상태명(+ 수동 관리 상태만 작은 회색 '수동 관리') + 안내.
 * 상태는 서버 응답 값을 그대로 보여 주며, 화면에서 기간으로 다시 계산하지 않습니다.
 * status가 null이면 아직 서버가 상태를 정하지 않은 새 행사입니다.
 */
export default function EventStatusIndicator({ status }: { status: EventStatus | null }) {
  const manual = status !== null && isManualEventStatus(status);

  return (
    <div className="admin-event-status">
      <p className="admin-event-status__line">
        <span className={`admin-event-status__dot is-${toneOf(status)}`} aria-hidden="true" />
        <strong>{status ? EVENT_STATUS_LABELS[status] : '저장 후 표시'}</strong>
        {manual && <small>수동 관리</small>}
      </p>
      <p className="admin-event-status__note">{noteOf(status)}</p>
    </div>
  );
}

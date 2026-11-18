export type ParticipationStatus = 'APPROVED' | 'CANCELLED' | 'COMPLETED' | 'DISQUALIFIED';

/**
 * 참가 상태 표시 라벨. 관리자 대회 현황의 '진행 중/완주', 신청서의 '참가 취소',
 * 참가 현황 요약의 '취소·실격 제외'와 같은 용어를 씁니다.
 */
export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  APPROVED: '진행 중',
  COMPLETED: '완주',
  CANCELLED: '참가 취소',
  DISQUALIFIED: '실격',
};

/** 알 수 없는 상태 값은 그대로 돌려줍니다. */
export function getParticipationStatusLabel(status: string) {
  return status in PARTICIPATION_STATUS_LABELS
    ? PARTICIPATION_STATUS_LABELS[status as ParticipationStatus]
    : status;
}

export type MyParticipation = {
  participationId: number;
  eventId: number;
  eventTitle: string;
  roundNo: number;
  eventStatus: string;
  eventStartDate: string;
  eventEndDate: string;
  courseId: number;
  courseName: string;
  targetDistanceMeter: number;
  standardBookCount: number;
  participationStatus: ParticipationStatus;
  totalPages: number;
  totalDistanceMeter: number;
  progressRate: number;
  completedAt: string | null;
  completionRank: number | null;
  approvedAt: string;
};

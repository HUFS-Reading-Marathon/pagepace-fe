export type MyParticipationEventStatus =
  | 'DRAFT'
  | 'READY'
  | 'APPLICATION_OPEN'
  | 'APPLICATION_CLOSED'
  | 'IN_PROGRESS'
  | 'ENDED'
  | 'FINALIZED'
  | 'ARCHIVED';

export type MyParticipationStatus =
  | 'APPROVED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DISQUALIFIED';

export type MyParticipation = {
  participationId: number;
  eventId: number;
  eventTitle: string;
  roundNo: number;
  eventStatus: MyParticipationEventStatus;
  eventStartDate: string;
  eventEndDate: string;
  courseId: number;
  courseName: string;
  targetDistanceMeter: number;
  standardBookCount: number;
  participationStatus: MyParticipationStatus;
  totalPages: number;
  totalDistanceMeter: number;
  progressRate: number;
  completedAt: string;
  completionRank: number;
  approvedAt: string;
};

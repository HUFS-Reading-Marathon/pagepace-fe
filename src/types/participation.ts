export type ParticipationStatus =
  | 'APPROVED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DISQUALIFIED';

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

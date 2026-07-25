import type { AdminParticipant, CourseType } from '../types/adminParticipant';
import type {
  AdminReadingLog,
  ReadingLogStatus,
} from '../types/adminReadingLog';

type StatusParticipantSeed = {
  id: string;
  name: string;
  studentNumber: string;
  course: CourseType;
  applicationStatus?: AdminParticipant['applicationStatus'];
};

type LogSeriesSeed = {
  participantId: string;
  participantName: string;
  studentNumber: string;
  totalPages: number;
  startDate: string;
};

function createStatusParticipant(
  seed: StatusParticipantSeed,
): AdminParticipant {
  return {
    id: seed.id,
    name: seed.name,
    loginId: seed.studentNumber,
    department: '현황 집계 테스트 소속',
    affiliation: 'undergraduate',
    grade: '2',
    phone: '010-0000-0000',
    email: `${seed.id}@example.edu`,
    course: seed.course,
    applicationStatus: seed.applicationStatus ?? 'APPROVED',
    appliedAt: '2026-06-20T09:00:00+09:00',
    privacyAgreed: true,
  };
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

function createLogSeries(seed: LogSeriesSeed): AdminReadingLog[] {
  const logs: AdminReadingLog[] = [];
  let remainingPages = seed.totalPages;
  let approvedPages = 0;
  let dayOffset = 0;

  while (remainingPages > 0) {
    const readPages = Math.min(400, remainingPages);
    const readingDate = addDays(seed.startDate, dayOffset);

    logs.push({
      id: `status-log-${seed.participantId}-${readingDate}`,
      participantId: seed.participantId,
      participantName: seed.participantName,
      studentNumber: seed.studentNumber,
      readingDate,
      submittedAt: `${readingDate}T20:00:00+09:00`,
      approvedAt: `${readingDate}T22:00:00+09:00`,
      status: 'approve',
      books: [
        {
          id: `status-entry-${seed.participantId}-${readingDate}`,
          bookId: `status-book-${seed.participantId}`,
          title: `${seed.participantName}의 장편 독서`,
          author: '현황목업',
          publisher: '예시출판',
          totalPages: 12000,
          previouslyApprovedPages: approvedPages,
          readPages,
          reviewWritten: true,
        },
      ],
    });

    remainingPages -= readPages;
    approvedPages += readPages;
    dayOffset += 1;
  }

  return logs;
}

function createSingleLog(
  participant: Pick<
    AdminParticipant,
    'id' | 'name' | 'loginId'
  >,
  readingDate: string,
  readPages: number,
  status: ReadingLogStatus,
): AdminReadingLog {
  return {
    id: `status-extra-${participant.id}-${readingDate}-${status}`,
    participantId: participant.id,
    participantName: participant.name,
    studentNumber: participant.loginId,
    readingDate,
    submittedAt: `${readingDate}T21:00:00+09:00`,
    status,
    rejectionReason:
      status === 'rejected' ? '현황 집계 제외 확인용 목업' : undefined,
    books: [
      {
        id: `status-extra-entry-${participant.id}-${readingDate}-${status}`,
        bookId: `status-extra-book-${participant.id}`,
        title: '집계 제외 상태 확인용 기록',
        author: '현황목업',
        publisher: '예시출판',
        totalPages: 500,
        previouslyApprovedPages: 0,
        readPages,
        reviewWritten: false,
      },
    ],
  };
}

export const STATUS_PARTICIPANTS: AdminParticipant[] = [
  createStatusParticipant({
    id: 'status-participant-01',
    name: '민',
    studentNumber: 'STATUS1001',
    course: 'short',
  }),
  createStatusParticipant({
    id: 'status-participant-02',
    name: '김민',
    studentNumber: 'STATUS1002',
    course: 'short',
  }),
  createStatusParticipant({
    id: 'status-participant-03',
    name: '박시현',
    studentNumber: 'STATUS1003',
    course: 'short',
  }),
  createStatusParticipant({
    id: 'status-participant-04',
    name: '남궁민수',
    studentNumber: 'STATUS1004',
    course: 'half',
  }),
  createStatusParticipant({
    id: 'status-participant-05',
    name: '윤책길',
    studentNumber: 'STATUS1005',
    course: 'half',
  }),
  createStatusParticipant({
    id: 'status-participant-06',
    name: '최하람',
    studentNumber: 'STATUS1006',
    course: 'half',
  }),
  createStatusParticipant({
    id: 'status-participant-07',
    name: 'Alex Kim',
    studentNumber: 'STATUS1007',
    course: 'full',
  }),
  createStatusParticipant({
    id: 'status-participant-08',
    name: '정은별',
    studentNumber: 'STATUS1008',
    course: 'full',
  }),
  createStatusParticipant({
    id: 'status-participant-09',
    name: '한페이지',
    studentNumber: 'STATUS1009',
    course: 'full',
  }),
  createStatusParticipant({
    id: 'status-participant-10',
    name: '취소참가',
    studentNumber: 'STATUS1010',
    course: 'short',
    applicationStatus: 'CANCELLED',
  }),
  createStatusParticipant({
    id: 'status-participant-11',
    name: '대기참가',
    studentNumber: 'STATUS1011',
    course: 'half',
    applicationStatus: 'PENDING',
  }),
];

const APPROVED_LOG_SERIES = [
  {
    participantId: 'status-participant-01',
    participantName: '민',
    studentNumber: 'STATUS1001',
    totalPages: 2200,
    startDate: '2026-07-17',
  },
  {
    participantId: 'status-participant-02',
    participantName: '김민',
    studentNumber: 'STATUS1002',
    totalPages: 1300,
    startDate: '2026-07-20',
  },
  {
    participantId: 'status-participant-03',
    participantName: '박시현',
    studentNumber: 'STATUS1003',
    totalPages: 2200,
    startDate: '2026-07-20',
  },
  {
    participantId: 'status-participant-04',
    participantName: '남궁민수',
    studentNumber: 'STATUS1004',
    totalPages: 4500,
    startDate: '2026-07-13',
  },
  {
    participantId: 'status-participant-05',
    participantName: '윤책길',
    studentNumber: 'STATUS1005',
    totalPages: 3100,
    startDate: '2026-07-16',
  },
  {
    participantId: 'status-participant-06',
    participantName: '최하람',
    studentNumber: 'STATUS1006',
    totalPages: 4500,
    startDate: '2026-07-14',
  },
  {
    participantId: 'status-participant-07',
    participantName: 'Alex Kim',
    studentNumber: 'STATUS1007',
    totalPages: 9000,
    startDate: '2026-07-03',
  },
  {
    participantId: 'status-participant-08',
    participantName: '정은별',
    studentNumber: 'STATUS1008',
    totalPages: 6200,
    startDate: '2026-07-08',
  },
  {
    participantId: 'status-participant-09',
    participantName: '한페이지',
    studentNumber: 'STATUS1009',
    totalPages: 9000,
    startDate: '2026-07-02',
  },
] satisfies LogSeriesSeed[];

const cancelledParticipant = STATUS_PARTICIPANTS[9];
const pendingParticipant = STATUS_PARTICIPANTS[10];
const submittedParticipant = STATUS_PARTICIPANTS[1];
const rejectedParticipant = STATUS_PARTICIPANTS[4];

export const STATUS_READING_LOGS: AdminReadingLog[] = [
  ...APPROVED_LOG_SERIES.flatMap(createLogSeries),
  createSingleLog(
    submittedParticipant,
    '2026-07-25',
    400,
    'submit',
  ),
  createSingleLog(
    rejectedParticipant,
    '2026-07-25',
    300,
    'rejected',
  ),
  createSingleLog(
    cancelledParticipant,
    '2026-07-25',
    400,
    'approve',
  ),
  createSingleLog(
    pendingParticipant,
    '2026-07-25',
    400,
    'approve',
  ),
];

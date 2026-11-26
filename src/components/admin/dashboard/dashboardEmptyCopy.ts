import type { EventStatus } from '../../../types/adminEvent';

/** 운영 통계 빈 상태가 놓이는 자리 */
export type DashboardEmptyKind = 'page' | 'trend' | 'affiliation';

export type DashboardEmptyIcon = 'calendar' | 'inbox' | 'bars' | 'group';

type EmptyCopy = { icon: DashboardEmptyIcon; title: string; description: string };

/** 행사 시작 전 상태(아직 신청·독서일지가 쌓일 수 없는 단계) */
const BEFORE_START: ReadonlySet<string> = new Set([
  'DRAFT',
  'READY',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSED',
]);
const FINISHED: ReadonlySet<string> = new Set(['ENDED', 'FINALIZED', 'ARCHIVED']);

export type DashboardEmptyPhase = 'before' | 'running' | 'finished';

/** 실제 행사 상태로 시작 전 / 진행 중(그 밖의 알 수 없는 값 포함) / 종료 후를 구분합니다. */
export function getEmptyPhase(
  status: EventStatus | string | null | undefined,
): DashboardEmptyPhase {
  if (status && BEFORE_START.has(status)) return 'before';
  if (status && FINISHED.has(status)) return 'finished';
  return 'running';
}

const COPY: Record<DashboardEmptyKind, Record<DashboardEmptyPhase, EmptyCopy>> = {
  page: {
    before: {
      icon: 'calendar',
      title: '행사 시작 전입니다',
      description: '참가 신청과 독서일지가 접수되면 운영 데이터가 집계됩니다.',
    },
    running: {
      icon: 'inbox',
      title: '아직 집계할 운영 데이터가 없습니다',
      description: '참가 신청이나 독서일지가 접수되면 이곳에 표시됩니다.',
    },
    finished: {
      icon: 'inbox',
      title: '집계된 운영 데이터가 없습니다',
      description: '이 행사에는 신청과 독서일지 기록이 없습니다.',
    },
  },
  trend: {
    before: {
      icon: 'calendar',
      title: '행사 시작 전입니다',
      description: '독서일지 접수가 시작되면 활동 그래프가 표시됩니다.',
    },
    running: {
      icon: 'bars',
      title: '선택한 기간에 독서 활동이 없습니다',
      description: '참가자가 독서일지를 제출하면 그래프가 표시됩니다.',
    },
    finished: {
      icon: 'bars',
      title: '선택한 기간에 독서 활동이 없습니다',
      description: '기간을 바꿔 다른 날의 활동을 확인해 보세요.',
    },
  },
  affiliation: {
    before: {
      icon: 'calendar',
      title: '행사 시작 전입니다',
      description: '참가가 승인되면 소속 분포가 표시됩니다.',
    },
    running: {
      icon: 'group',
      title: '승인된 참가자가 없습니다',
      description: '참가자가 승인되면 소속 분포가 표시됩니다.',
    },
    finished: {
      icon: 'group',
      title: '승인된 참가자가 없습니다',
      description: '이 행사에는 승인된 참가자 기록이 없습니다.',
    },
  },
};

export function getEmptyCopy(
  kind: DashboardEmptyKind,
  status: EventStatus | string | null | undefined,
): EmptyCopy {
  return COPY[kind][getEmptyPhase(status)];
}

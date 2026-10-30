import type { AdminEvent, EventStatus } from '../types/adminEvent';

/**
 * 상태 우선순위 순서대로 처음 발견되는 행사를 기본 선택 행사로 고릅니다.
 * 우선순위에 해당하는 행사가 없으면 목록의 첫 행사를 사용합니다.
 */
export function chooseEventIdByStatus(
  events: ReadonlyArray<AdminEvent>,
  statusOrder: ReadonlyArray<EventStatus>,
) {
  for (const status of statusOrder) {
    const matchedEvent = events.find((event) => event.status === status);

    if (matchedEvent) {
      return matchedEvent.eventId;
    }
  }

  return events[0]?.eventId ?? null;
}

/**
 * 기간 입력 시 참고할 "직전 행사"를 고릅니다.
 * 수정 중인 행사가 있으면 그보다 회차가 낮은 행사 중 가장 높은 회차를,
 * 없으면(신규 생성 등) 전체 행사 중 가장 높은 회차를 반환합니다.
 */
export function findPreviousEvent(
  events: ReadonlyArray<AdminEvent>,
  excludeEventId: number | null,
  currentRoundNo: number | null,
): AdminEvent | null {
  const candidates = events.filter((event) => event.eventId !== excludeEventId);

  if (candidates.length === 0) {
    return null;
  }

  if (currentRoundNo !== null && Number.isFinite(currentRoundNo)) {
    const earlierRounds = candidates.filter((event) => event.roundNo < currentRoundNo);

    if (earlierRounds.length > 0) {
      return earlierRounds.reduce((latest, event) =>
        event.roundNo > latest.roundNo ? event : latest,
      );
    }

    return null;
  }

  return candidates.reduce((latest, event) => (event.roundNo > latest.roundNo ? event : latest));
}

const ADMIN_EVENT_STORAGE_KEY = 'pagepaceAdminEventId';

/**
 * 관리자 화면 사이를 오갈 때 같은 회차를 계속 보도록 마지막으로 선택한 행사를 기억합니다.
 * 탭(세션) 단위로만 유지하며, 저장소를 쓸 수 없는 환경에서는 조용히 무시합니다.
 */
export function rememberAdminEventId(eventId: number) {
  try {
    sessionStorage.setItem(ADMIN_EVENT_STORAGE_KEY, String(eventId));
  } catch {
    // 저장소 접근이 막힌 환경에서는 기본 선택 규칙만 사용합니다.
  }
}

function getRememberedAdminEventId() {
  try {
    const eventId = Number(sessionStorage.getItem(ADMIN_EVENT_STORAGE_KEY));

    return Number.isInteger(eventId) && eventId > 0 ? eventId : null;
  } catch {
    return null;
  }
}

/**
 * 다른 관리자 화면에서 마지막으로 선택한 행사가 목록에 있으면 그 행사를,
 * 없으면 상태 우선순위에 따라 기본 행사를 고릅니다.
 */
export function chooseAdminEventId(
  events: ReadonlyArray<AdminEvent>,
  statusOrder: ReadonlyArray<EventStatus>,
) {
  const rememberedEventId = getRememberedAdminEventId();

  if (rememberedEventId !== null && events.some((event) => event.eventId === rememberedEventId)) {
    return rememberedEventId;
  }

  return chooseEventIdByStatus(events, statusOrder);
}

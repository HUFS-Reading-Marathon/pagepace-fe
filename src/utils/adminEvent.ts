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

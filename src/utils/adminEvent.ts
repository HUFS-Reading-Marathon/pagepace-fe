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

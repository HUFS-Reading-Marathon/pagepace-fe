export type EventScope = 'personal' | 'public' | 'admin';
const key = (scope: EventScope) => `pagepace:${scope}:event`;
export function selectedEventId(scope: EventScope): number | undefined {
  const value = Number(sessionStorage.getItem(key(scope)));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
export function selectEvent(scope: EventScope, id?: number) {
  if (id) sessionStorage.setItem(key(scope), String(id));
  else sessionStorage.removeItem(key(scope));
  window.dispatchEvent(new Event('pagepace:event-selection'));
}
export function eventQuery(id?: number) {
  return id ? `?eventId=${id}` : '';
}
export function preferredAdminEvent<T extends { eventId: number; status: string }>(events: T[]) {
  return (
    events.find((event) => event.eventId === selectedEventId('admin')) ??
    events.find((event) => event.status === 'IN_PROGRESS') ??
    events.find((event) => event.status === 'APPLICATION_OPEN') ??
    events[0]
  );
}
export function koreaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (name: string) => parts.find((part) => part.type === name)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function canApply(
  event: { status: string; applicationStartDate: string; applicationEndDate: string } | null,
  today = koreaToday(),
) {
  return (
    !!event &&
    event.status === 'APPLICATION_OPEN' &&
    today >= event.applicationStartDate &&
    today <= event.applicationEndDate
  );
}

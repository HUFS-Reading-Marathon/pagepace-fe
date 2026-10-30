import { useEffect } from 'react';
import { rememberAdminEventId } from '../utils/adminEvent';

/** 화면에서 선택 중인 관리 행사를 다른 관리자 화면에서도 기본값으로 쓰도록 기억합니다. */
export function useRememberedAdminEvent(eventId: number | null) {
  useEffect(() => {
    if (eventId !== null) {
      rememberAdminEventId(eventId);
    }
  }, [eventId]);
}

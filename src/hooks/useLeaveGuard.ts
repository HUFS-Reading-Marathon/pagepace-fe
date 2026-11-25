import { useEffect } from 'react';

export const LEAVE_MESSAGE = '작성 중인 내용이 있습니다. 이 화면을 나갈까요?';

/**
 * 저장하지 않은 입력이 있으면 새로고침·창 닫기와 화면 안 링크 이동 전에 확인합니다.
 * BrowserRouter라 라우터 차단 기능을 쓸 수 없어, 링크 클릭을 캡처 단계에서 확인합니다
 * (관리자 공지 편집기와 같은 방식).
 */
export function useLeaveGuard(active: boolean, message = LEAVE_MESSAGE) {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}

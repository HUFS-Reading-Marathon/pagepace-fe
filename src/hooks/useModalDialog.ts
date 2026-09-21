import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';

type UseModalDialogOptions = {
  onClose: () => void;
  /** 다이얼로그가 열릴 때 포커스를 옮길 요소 (보통 닫기 버튼) */
  initialFocusRef: RefObject<HTMLElement | null>;
  /** 닫힐 때 다이얼로그를 열기 전 포커스 요소로 되돌릴지 여부 */
  restoreFocus?: boolean;
};

/**
 * 관리자 모달 다이얼로그 공통 동작:
 * - 열려 있는 동안 body 스크롤 잠금
 * - 열릴 때 initialFocusRef로 포커스 이동
 * - Escape 키로 닫기
 * - 배경(backdrop) 클릭 시 닫기 핸들러 제공
 */
export function useModalDialog({
  onClose,
  initialFocusRef,
  restoreFocus = false,
}: UseModalDialogOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      restoreFocus && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    initialFocusRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
    // 마운트 시 한 번만 실행되는 초기화 동작입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return { handleBackdropMouseDown };
}

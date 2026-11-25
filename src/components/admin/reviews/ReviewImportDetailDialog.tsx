import { useEffect, useRef, type ReactNode } from 'react';
import './review-import-dialog.css';

type Props = {
  /** 반영 요청 중이면 Esc로 닫지 않습니다. */
  busy: boolean;
  /** 닫기 요청 (Esc·닫기 버튼). 작성 중인 메모 확인은 호출한 쪽에서 합니다. */
  onRequestClose: () => void;
  children: ReactNode;
};

/**
 * 엑셀 대조 상세를 띄우는 대형 모달. 브라우저 기본 <dialog>의 모달 모드(top layer)를 써서
 * 사이드바나 본문 컨테이너에 잘리지 않고, 열린 동안 배경은 클릭·포커스가 막힙니다.
 * 배경을 눌러도 닫히지 않으며, 배경 페이지는 스크롤되지 않습니다.
 */
export default function ReviewImportDetailDialog({ busy, onRequestClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    if (element && !element.open) element.showModal();
    return () => {
      element?.close();
      root.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="admin-review-dialog"
      aria-labelledby="reviewImportDetailTitle"
      onCancel={(event) => {
        // Esc: 기본 닫기를 막고, 처리 중이 아닐 때만 닫기 요청을 보냅니다.
        event.preventDefault();
        if (!busy) onRequestClose();
      }}
    >
      {children}
    </dialog>
  );
}

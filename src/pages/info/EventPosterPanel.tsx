import { useEffect, useRef, useState } from 'react';
import type { EventPoster } from './eventPosters';

/**
 * 원본 이미지를 화면에 맞춰 크게 보여 주는 모달. 브라우저 기본 <dialog>의 모달 모드를 써서
 * Esc로 닫히고 배경은 클릭·포커스가 막히며, 닫으면 열었던 버튼으로 초점이 돌아갑니다.
 */
function PosterDialog({
  poster,
  title,
  onClose,
}: {
  poster: EventPoster;
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    // 열린 동안 배경 페이지가 스크롤되지 않게 합니다.
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
      className="poster-dialog"
      aria-label={`${title} 포스터 크게 보기`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // 이미지 바깥(배경)을 누르면 닫습니다.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="poster-dialog-close"
        onClick={onClose}
        aria-label="닫기"
        autoFocus
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
      <picture>
        <source srcSet={poster.full} type="image/webp" />
        <img
          src={poster.original}
          width={poster.width}
          height={poster.height}
          alt={poster.alt}
          decoding="async"
        />
      </picture>
    </dialog>
  );
}

/**
 * 공식 포스터. 원본 비율(2:3)을 그대로 두고 덧씌우는 문구나 장식이 없습니다.
 * 이미지를 불러오지 못하면 onUnavailable을 불러 포스터 없이 소개만 보여 줍니다.
 */
export default function EventPosterPanel({
  poster,
  title,
  onUnavailable,
}: {
  poster: EventPoster;
  /** 현재 행사명(모달 이름에 씁니다) */
  title: string;
  onUnavailable: () => void;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  const show = (event: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    // 모달을 연 버튼으로 초점을 되돌립니다.
    requestAnimationFrame(() => opener.current?.focus());
  };

  return (
    <figure className="about-poster">
      <button
        type="button"
        className="about-poster__frame"
        onClick={show}
        aria-label={`${title} 포스터 크게 보기`}
        aria-haspopup="dialog"
      >
        <picture>
          <source srcSet={`${poster.display} 640w, ${poster.full} 1024w`} type="image/webp" />
          <img
            src={poster.original}
            sizes="(max-width: 760px) 240px, 320px"
            width={poster.width}
            height={poster.height}
            alt={poster.alt}
            decoding="async"
            fetchPriority="high"
            onError={onUnavailable}
          />
        </picture>
      </button>
      {open && <PosterDialog poster={poster} title={title} onClose={close} />}
    </figure>
  );
}

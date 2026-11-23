import { useEffect, type RefObject } from 'react';

/**
 * 메인페이지 섹션 스크롤 리빌.
 *
 * root 안의 `[data-reveal]` 요소 중 첫 화면 아래에 있는 것만 숨겼다가, 화면에 들어오면
 * 한 번만 나타나게 하고 관찰을 해제합니다. 이미 보이는 콘텐츠는 건드리지 않습니다.
 * IntersectionObserver 미지원·reduced motion 환경이나 JS 실행 전에는 아무것도 숨기지 않습니다.
 * 숨김/등장 스타일은 MainPage.css의 `[data-reveal-state]` 규칙이 담당합니다.
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (element) => element.getBoundingClientRect().top >= window.innerHeight,
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset.revealState = 'shown';
          observer.unobserve(element);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    for (const element of targets) {
      element.dataset.revealState = 'hidden';
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      for (const element of targets) delete element.dataset.revealState;
    };
  }, [rootRef]);
}

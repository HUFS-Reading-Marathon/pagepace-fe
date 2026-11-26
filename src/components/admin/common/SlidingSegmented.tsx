import { useLayoutEffect, useRef } from 'react';

type Option<T extends string> = { value: T; label: string };

/**
 * 선택된 흰색 배경(인디케이터)이 항목 사이를 부드럽게 미끄러지는 필터 묶음. 글자 위치는 그대로입니다.
 * 운영 통계의 슬라이딩 필터와 같은 방식(첫 표시는 애니메이션 없이, 이후 260ms ease-out)이며,
 * 빠르게 연속으로 눌러도 현재 위치에서 새 목표로 이어서 움직입니다. 동작 줄이기 설정에서는 바로 이동합니다.
 * 모양은 기존 admin-segmented를 그대로 씁니다.
 */
export default function SlidingSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator) return;

    const update = () => {
      const selected = group.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!selected) return;
      indicator.style.width = `${selected.offsetWidth}px`;
      indicator.style.height = `${selected.offsetHeight}px`;
      indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
      indicator.style.visibility = 'visible';
    };

    indicator.style.transition = positioned.current ? '' : 'none';
    update();
    positioned.current = true;

    const observer = new ResizeObserver(update);
    observer.observe(group);
    group.querySelectorAll('button').forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={groupRef}
      className="admin-segmented admin-segmented--sliding"
      role="group"
      aria-label={label}
    >
      <span ref={indicatorRef} className="admin-segmented__indicator" aria-hidden="true" />
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

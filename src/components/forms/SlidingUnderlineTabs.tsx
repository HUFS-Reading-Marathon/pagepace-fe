import { useLayoutEffect, useRef } from 'react';
import './sliding-underline-tabs.css';

type Option<T> = { value: T; label: string };

/** 기존 Sliding Underline과 같은 위치·너비 전환을 사용하는 접근 가능한 탭입니다. */
export default function SlidingUnderlineTabs<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const root = list.current;
    const line = indicator.current;
    if (!root || !line) return;
    const update = () => {
      const selected = root.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (!selected) return;
      line.style.width = `${selected.offsetWidth}px`;
      line.style.transform = `translateX(${selected.offsetLeft}px)`;
      line.style.visibility = 'visible';
    };
    line.style.transition = positioned.current ? '' : 'none';
    update();
    positioned.current = true;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    root.querySelectorAll('button').forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={list} className="sliding-underline-tabs" role="tablist" aria-label={label}>
      <span ref={indicator} className="sliding-underline-tabs__indicator" aria-hidden="true" />
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${id}-${option.value}-tab`}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-controls={`${id}-${option.value}-panel`}
          tabIndex={value === option.value ? 0 : -1}
          data-label={option.label}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) %
                    options.length;
            onChange(options[next].value);
            list.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
          }}
        >
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

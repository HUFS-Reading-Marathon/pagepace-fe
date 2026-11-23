import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

type Choice = { value: string; label: string; disabled?: boolean };

type Props = {
  label: string;
  value: string;
  options: readonly Choice[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
};

export default function EditorChoiceField({
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  placeholder = '선택',
  className,
  searchable,
}: Props) {
  const id = useId();
  const listId = id + '-list';
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(needle))
    : options;
  const enabled = visible.filter((option) => !option.disabled);
  const active = enabled.find((option) => option.value === cursor) ?? enabled[0];
  const activeIndex = active ? visible.indexOf(active) : -1;
  const activeId = open && activeIndex >= 0 ? listId + '-' + activeIndex : undefined;

  function expand() {
    setQuery('');
    setCursor(value);
    setOpen(true);
  }

  function choose(option: Choice) {
    if (option.disabled || disabled) return;
    onChange(option.value);
    setInvalid(false);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    (search.current ?? trigger.current)?.focus({ preventScroll: true });
    // Only the dialog body scrolls to reveal the choices near its lower edge.
    root.current?.querySelector('.editor-choice__panel')?.scrollIntoView({ block: 'nearest' });
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    // Let the next row receive its click before collapsing this row above it.
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, [open]);

  useEffect(() => {
    const box = list.current;
    if (!box || activeIndex < 0) return;
    const option = box.children[activeIndex]?.getBoundingClientRect();
    if (!option) return;
    const bounds = box.getBoundingClientRect();
    if (option.top < bounds.top) box.scrollTop -= bounds.top - option.top;
    else if (option.bottom > bounds.bottom) box.scrollTop += option.bottom - bounds.bottom;
  }, [open, activeIndex, query]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    const { key } = event;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        expand();
      }
      return;
    }
    if (key === 'Escape' || key === 'Tab') {
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      trigger.current?.focus({ preventScroll: true });
      setOpen(false);
      return;
    }
    if (key === 'Enter' || (key === ' ' && event.target === trigger.current)) {
      event.preventDefault();
      if (active) choose(active);
      return;
    }
    if (!enabled.length) return;
    const index = active ? enabled.indexOf(active) : 0;
    let next: Choice | undefined;
    if (key === 'ArrowDown') next = enabled[Math.min(index + 1, enabled.length - 1)];
    else if (key === 'ArrowUp') next = enabled[Math.max(index - 1, 0)];
    else if (event.target !== search.current) {
      if (key === 'Home') next = enabled[0];
      else if (key === 'End') next = enabled[enabled.length - 1];
      else if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        next = [...enabled.slice(index + 1), ...enabled.slice(0, index + 1)].find((option) =>
          option.label.toLocaleLowerCase().startsWith(key.toLocaleLowerCase()),
        );
      }
    }
    if (next) {
      event.preventDefault();
      setCursor(next.value);
    }
  }

  return (
    <div
      ref={root}
      className={['editor-choice', className].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
    >
      <label id={id + '-label'} htmlFor={id}>
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className="editor-choice__trigger"
        aria-labelledby={id + '-label'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-required={required}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : expand())}
      >
        {selected?.label ?? placeholder}
      </button>
      {required && (
        <select
          className="editor-choice__validation"
          aria-hidden="true"
          tabIndex={-1}
          required
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            if (
              event.currentTarget.form?.querySelector(
                'input:invalid, select:invalid, textarea:invalid',
              ) === event.currentTarget
            ) {
              expand();
              trigger.current?.focus();
            }
          }}
        >
          <option value="" />
          {value && <option value={value}>{selected?.label ?? value}</option>}
        </select>
      )}
      {open && (
        <div className="editor-choice__panel">
          {searchable && (
            <input
              type="search"
              ref={search}
              value={query}
              placeholder="검색"
              aria-label={label + ' 검색'}
              aria-controls={listId}
              aria-activedescendant={activeId}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(undefined);
              }}
            />
          )}
          <ul
            ref={list}
            className="editor-choice__options"
            id={listId}
            role="listbox"
            aria-labelledby={id + '-label'}
          >
            {visible.map((option, i) => (
              <li
                key={option.value}
                role="option"
                id={listId + '-' + i}
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-active={i === activeIndex || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
          {!visible.length && (
            <p className="editor-choice__empty" role="status">
              검색 결과가 없습니다.
            </p>
          )}
        </div>
      )}
      {invalid && !value && (
        <span className="editor-choice__error" role="alert">
          {label} 항목을 선택해 주세요.
        </span>
      )}
    </div>
  );
}

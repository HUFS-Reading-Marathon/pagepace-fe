import { useLayoutEffect, useRef, useState } from 'react';

const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;

export function middleEllipsis(
  value: string,
  width: number,
  measure: (text: string) => number,
): string {
  if (!value || measure(value) <= width) return value;
  const letters = segmenter
    ? Array.from(segmenter.segment(value), (part) => part.segment)
    : Array.from(value);
  let result = '…';
  let low = 2;
  let high = letters.length - 1;
  while (low <= high) {
    const count = Math.floor((low + high) / 2);
    const candidate =
      letters.slice(0, Math.ceil(count / 2)).join('') +
      '…' +
      letters.slice(-Math.floor(count / 2)).join('');
    if (measure(candidate) <= width) {
      result = candidate;
      low = count + 1;
    } else {
      high = count - 1;
    }
  }
  return result;
}

type CellMetric = { font: string; letterSpacing: string; padding: number };
function measureTableText(table: HTMLTableElement) {
  const context = document.createElement('canvas').getContext('2d');
  const metrics = new Map<string, CellMetric>();
  for (const cell of table.querySelectorAll<HTMLTableCellElement>(
    'tbody tr:first-child td[data-column]',
  )) {
    const style = getComputedStyle(cell.querySelector('.roster-name') ?? cell);
    const cellStyle = getComputedStyle(cell);
    metrics.set(cell.dataset.column as string, {
      font: style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily,
      letterSpacing: style.letterSpacing === 'normal' ? '0px' : style.letterSpacing,
      padding: parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight),
    });
  }
  return (key: string, text: string, width: number) => {
    const metric = metrics.get(key);
    if (!context || !metric) return text;
    context.font = metric.font;
    context.letterSpacing = metric.letterSpacing;
    return middleEllipsis(text, width - metric.padding - 1, (s) => context.measureText(s).width);
  };
}

export function useTableCellText(hasRows: boolean, layoutKey = '') {
  const table = useRef<HTMLTableElement>(null);
  const [fitText, setFitText] = useState<ReturnType<typeof measureTableText> | null>(null);
  useLayoutEffect(() => {
    if (!hasRows) return;
    let active = true;
    const measure = () => {
      if (active && table.current) {
        const fit = measureTableText(table.current);
        setFitText(() => fit);
      }
    };
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [hasRows, layoutKey]);
  return { table, fitText };
}

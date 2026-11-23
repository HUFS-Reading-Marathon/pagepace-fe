import type { RosterColumn } from '../../../utils/participantRoster';

export const CHECK_WIDTH = 28;
export type ColumnWidths = Record<RosterColumn, number>;

// The compact and desktop reference widths set each column’s share of available space.
const REFERENCE_WIDTHS: Record<RosterColumn, readonly [number, number]> = {
  number: [44, 44],
  name: [84, 96],
  studentNo: [96, 124],
  affiliationType: [88, 104],
  department: [128, 164],
  courseName: [76, 108],
  status: [62, 84],
  phone: [124, 156],
  registeredAt: [96, 132],
};
export const MIN_WIDTH: ColumnWidths = {
  number: 44,
  name: 58,
  studentNo: 90,
  affiliationType: 58,
  department: 58,
  courseName: 58,
  status: 58,
  phone: 68,
  registeredAt: 68,
};
export const MAX_WIDTH = 3200;
const columns = Object.keys(REFERENCE_WIDTHS) as RosterColumn[];
const compactTotal = CHECK_WIDTH + columns.reduce((sum, key) => sum + REFERENCE_WIDTHS[key][0], 0);
const growthTotal = columns.reduce(
  (sum, key) => sum + REFERENCE_WIDTHS[key][1] - REFERENCE_WIDTHS[key][0],
  0,
);

export function defaultColumnWidths(viewportWidth: number): ColumnWidths {
  const ratio = Math.max(0, (Math.floor(viewportWidth) - compactTotal) / growthTotal);
  const widths = {} as ColumnWidths;
  let capacity = 0;
  for (const key of columns) {
    const [compact, roomy] = REFERENCE_WIDTHS[key];
    const used = Math.round(capacity * ratio);
    capacity += roomy - compact;
    widths[key] = compact + Math.round(capacity * ratio) - used;
  }
  return widths;
}

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
export function measureRosterText(table: HTMLTableElement) {
  const context = document.createElement('canvas').getContext('2d');
  const metrics = new Map<RosterColumn, CellMetric>();
  for (const cell of table.querySelectorAll<HTMLTableCellElement>(
    'tbody tr:first-child td[data-column]',
  )) {
    const style = getComputedStyle(cell.querySelector('.roster-name') ?? cell);
    const cellStyle = getComputedStyle(cell);
    metrics.set(cell.dataset.column as RosterColumn, {
      font: style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily,
      letterSpacing: style.letterSpacing === 'normal' ? '0px' : style.letterSpacing,
      padding: parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight),
    });
  }
  return (key: RosterColumn, text: string, width: number) => {
    const metric = metrics.get(key);
    if (!context || !metric) return text;
    context.font = metric.font;
    context.letterSpacing = metric.letterSpacing;
    return middleEllipsis(text, width - metric.padding - 1, (s) => context.measureText(s).width);
  };
}

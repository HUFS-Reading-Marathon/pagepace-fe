import type { RosterColumn } from '../../../utils/participantRoster';

export const CHECK_WIDTH = 28;
const BASE_WIDTHS = {
  number: 44,
  name: 92,
  studentNo: 104,
  affiliationType: 92,
  department: 156,
  courseName: 90,
  status: 76,
  phone: 128,
  registeredAt: 108,
};
export type ColumnWidths = Record<RosterColumn, number>;
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
const baseTotal =
  CHECK_WIDTH + Object.values(BASE_WIDTHS).reduce((total, width) => total + width, 0);

export function defaultColumnWidths(viewportWidth: number): ColumnWidths {
  const extra = Math.max(0, Math.floor(viewportWidth) - baseTotal);
  const name = Math.floor(extra * 0.23);
  const studentNo = Math.floor(extra * 0.16);
  const course = Math.floor(extra * 0.17);
  return {
    ...BASE_WIDTHS,
    name: BASE_WIDTHS.name + name,
    studentNo: BASE_WIDTHS.studentNo + studentNo,
    courseName: BASE_WIDTHS.courseName + course,
    department: BASE_WIDTHS.department + extra - name - studentNo - course,
  };
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

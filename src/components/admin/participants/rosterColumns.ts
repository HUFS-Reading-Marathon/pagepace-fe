import type { RosterColumn } from '../../../utils/participantRoster';

import { CHECK_WIDTH, distributeWidths } from '../table/tableColumns';
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
const columns = Object.keys(REFERENCE_WIDTHS) as RosterColumn[];

export function defaultColumnWidths(viewportWidth: number): ColumnWidths {
  return distributeWidths(columns, viewportWidth - CHECK_WIDTH, REFERENCE_WIDTHS);
}

import { ROSTER_STATUSES, rosterStatus, type RosterRow } from '../api/adminRosterApi';
import { ADMIN_APPLICATION_AFFILIATION_LABELS } from '../types/adminApplication';

export const EMPTY_FILTERS = { query: '', status: '', course: '', affiliation: '' };
export const DEFAULT_FILTERS = { ...EMPTY_FILTERS, status: 'PARTICIPANTS' };
export type RosterFilters = typeof EMPTY_FILTERS;

export const ROSTER_COLUMNS = {
  number: '순번',
  name: '이름',
  studentNo: '학번/사번',
  affiliationType: '신분',
  department: '소속',
  courseName: '코스',
  status: '상태',
  phone: '연락처',
  registeredAt: '등록일',
} as const;
export type RosterColumn = keyof typeof ROSTER_COLUMNS;
export type RosterSort = {
  column: Exclude<RosterColumn, 'number'>;
  direction: 'ascending' | 'descending';
};
export const DEFAULT_SORT: RosterSort = { column: 'name', direction: 'ascending' };
export type NumberedRow = RosterRow & { number: number };
const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

export function matchesRosterRow(row: RosterRow, f: RosterFilters) {
  const query = f.query.trim().toLocaleLowerCase();
  const status = rosterStatus(row);
  const statusMatches =
    f.status === 'PARTICIPANTS'
      ? status === 'APPROVED' || status === 'COMPLETED'
      : !f.status || f.status === status;
  return (
    statusMatches &&
    (!f.course || String(row.courseId) === f.course) &&
    (!f.affiliation || row.affiliationType === f.affiliation) &&
    (!query ||
      [row.name, row.email, row.studentNo, row.phone, row.college, row.department].some((value) =>
        value?.toLocaleLowerCase().includes(query),
      ) ||
      (/^[\d\s-]+$/.test(query) &&
        !!row.phone &&
        row.phone.replace(/[-\s]/g, '').includes(query.replace(/[-\s]/g, '')) &&
        /\d/.test(query)))
  );
}

function byName(a: RosterRow, b: RosterRow) {
  return (
    collator.compare(a.name, b.name) ||
    collator.compare(a.studentNo ?? '', b.studentNo ?? '') ||
    a.serialNo - b.serialNo
  );
}

export function rosterCell(row: NumberedRow, column: RosterColumn): string {
  return column === 'number' ? String(row.number) : dataCell(row, column);
}

function dataCell(row: RosterRow, column: RosterSort['column']): string {
  switch (column) {
    case 'affiliationType':
      return row.affiliationType === 'STAFF'
        ? '직원·연구원'
        : (ADMIN_APPLICATION_AFFILIATION_LABELS[row.affiliationType] ?? '');
    case 'status': {
      const status = rosterStatus(row);
      return status ? ROSTER_STATUSES[status] : '';
    }
    case 'registeredAt':
      return row.registeredAt?.slice(0, 10) ?? '';
    case 'phone': {
      const phone = row.phone?.trim() ?? '';
      const digits = phone.replace(/[-\s]/g, '');
      if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
      if (/^0\d{9,10}$/.test(digits))
        return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
      return phone;
    }
    default:
      return row[column] ?? '';
  }
}

export function sortedRoster(
  rows: RosterRow[],
  filters: RosterFilters,
  sort: RosterSort,
): NumberedRow[] {
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return rows
    .filter((row) => matchesRosterRow(row, filters))
    .sort((a, b) => {
      const left = dataCell(a, sort.column);
      const right = dataCell(b, sort.column);
      if (!left || !right) return Number(!left) - Number(!right) || byName(a, b);
      return direction * collator.compare(left, right) || byName(a, b);
    })
    .map((row, index) => ({ ...row, number: index + 1 }));
}

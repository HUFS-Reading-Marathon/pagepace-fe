import { rosterStatus, type RosterRow } from '../api/adminRosterApi';

export const EMPTY_FILTERS = { query: '', status: '', course: '', affiliation: '' };
export type RosterFilters = typeof EMPTY_FILTERS;

export function matchesRosterRow(row: RosterRow, f: RosterFilters) {
  const query = f.query.trim().toLocaleLowerCase();
  return (
    (!f.status || f.status === rosterStatus(row)) &&
    (!f.course || String(row.courseId) === f.course) &&
    (!f.affiliation || row.affiliationType === f.affiliation) &&
    (!query ||
      [row.name, row.email, row.studentNo, row.phone, row.college, row.department].some((value) =>
        value?.toLocaleLowerCase().includes(query),
      ))
  );
}

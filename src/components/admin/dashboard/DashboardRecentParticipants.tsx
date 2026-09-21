import { Link } from 'react-router-dom';
import {
  ADMIN_APPLICATION_STATUS_LABELS,
  type AdminApplicationListItem,
} from '../../../types/adminApplication';
import { formatKoDate } from '../../../utils/date';

type DashboardRecentParticipantsProps = {
  participants: AdminApplicationListItem[];
};

function DashboardRecentParticipants({ participants }: DashboardRecentParticipantsProps) {
  return (
    <section className="admin-dashboard__card admin-dashboard__operations-card admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>최근 참가 신청</h2>
      </header>

      {participants.length === 0 ? (
        <div className="admin-dashboard__empty">최근 참가 신청이 없습니다.</div>
      ) : (
        <div className="admin-dashboard__table-wrapper">
          <table className="admin-dashboard__table admin-dashboard__table--participants">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">소속</th>
                <th scope="col">코스</th>
                <th scope="col">상태</th>
                <th scope="col">신청일</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr key={participant.applicationId}>
                  <td>
                    <Link to="/admin/participants">{participant.name}</Link>
                  </td>
                  <td title={participant.department ?? undefined}>
                    {participant.department || '미입력'}
                  </td>
                  <td>{participant.courseName}</td>
                  <td>
                    <span
                      className={`admin-dashboard__status admin-dashboard__status--${
                        participant.status === 'APPLIED'
                          ? 'pending'
                          : participant.status.toLowerCase()
                      }`}
                    >
                      {ADMIN_APPLICATION_STATUS_LABELS[participant.status]}
                    </span>
                  </td>
                  <td>{formatKoDate(participant.appliedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link to="/admin/participants" className="admin-dashboard__card-link">
        전체 참가자 보기
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export default DashboardRecentParticipants;

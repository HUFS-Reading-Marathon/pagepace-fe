import './status.css';

const participants = [
  {
    id: 1,
    name: '박*현',
    course: '하프코스',
    pages: 1240,
    distance: 6200,
    progress: 29,
    isFinished: false,
  },
  {
    id: 2,
    name: '김*민',
    course: '단축코스',
    pages: 2050,
    distance: 10250,
    progress: 100,
    isFinished: true,
  },
  {
    id: 3,
    name: '이*서',
    course: '풀코스',
    pages: 3600,
    distance: 18000,
    progress: 43,
    isFinished: false,
  },
];

function MarathonStatusPage() {
  return (
    <main className="page-container">
      <section className="page-section">
        <p className="page-label">Marathon Status</p>
        <h1>대회 현황</h1>
        <p className="page-description">
          참가자별 누적 페이지, 누적 거리, 완주율을 확인할 수 있습니다. 개인정보 보호를 위해 이름은 일부 마스킹됩니다.
        </p>
      </section>

      <section className="status-grid">
        <article className="status-card">
          <span>총 참가자</span>
          <strong>{participants.length}명</strong>
          <p>현재 등록된 참가자 기준</p>
        </article>

        <article className="status-card">
          <span>완주자</span>
          <strong>{participants.filter((participant) => participant.isFinished).length}명</strong>
          <p>코스 목표 거리를 달성한 참가자</p>
        </article>

        <article className="status-card">
          <span>최고 누적 거리</span>
          <strong>
            {(Math.max(...participants.map((participant) => participant.distance)) / 1000).toFixed(2)}km
          </strong>
          <p>공개 현황 기준</p>
        </article>
      </section>

      <section className="table-section">
        <div className="section-row">
          <h2>참가자 현황</h2>
          <p>거리순 정렬, 코스별 필터는 API 연동 단계에서 추가 예정입니다.</p>
        </div>

        <div className="table-scroll official-card">
          <table className="program-table">
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">이름</th>
                <th scope="col">코스</th>
                <th scope="col">누적 페이지</th>
                <th scope="col">누적 거리</th>
                <th scope="col">완주율</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {participants
                .sort((a, b) => b.distance - a.distance)
                .map((participant, index) => (
                  <tr key={participant.id}>
                    <td>{index + 1}</td>
                    <td>{participant.name}</td>
                    <td>{participant.course}</td>
                    <td>{participant.pages.toLocaleString()}쪽</td>
                    <td>{(participant.distance / 1000).toFixed(2)}km</td>
                    <td>{participant.progress}%</td>
                    <td>{participant.isFinished ? 'FULL' : '진행중'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default MarathonStatusPage;
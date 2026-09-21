import type { CourseRow } from '../../pages/main/mainPageContent';

type CourseBenefitTableProps = {
  courses: CourseRow[];
};

/** 코스 및 혜택 표 */
function CourseBenefitTable({ courses }: CourseBenefitTableProps) {
  return (
    <div className="table-scroll official-card fade-up">
      <table className="program-table">
        <caption className="sr-only">제5회 독서마라톤 코스 및 혜택 표</caption>
        <thead>
          <tr>
            <th scope="col">코스명</th>
            <th scope="col">목표 거리</th>
            <th scope="col">목표 페이지</th>
            <th scope="col">
              독서권수
              <br />
              <small>300쪽 기준</small>
            </th>
            <th scope="col">
              평균 1개월
              <br />
              독서량
            </th>
            <th scope="col">상금 또는 문화상품권</th>
            <th scope="col">추가대출</th>
            <th scope="col">인원</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.name}>
              <th scope="row">{course.name}</th>
              <td>{course.distance}</td>
              <td>{course.pages}</td>
              <td>{course.books}</td>
              <td>{course.monthly}</td>
              <td>{course.reward}</td>
              <td>{course.loan}</td>
              <td>{course.people}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CourseBenefitTable;

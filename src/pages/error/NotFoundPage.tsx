import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="page-section">
      <p className="page-label">404</p>
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p className="page-description">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
      </p>

      <Link to="/" className="text-link">
        메인으로 돌아가기
      </Link>
    </section>
  );
}

export default NotFoundPage;
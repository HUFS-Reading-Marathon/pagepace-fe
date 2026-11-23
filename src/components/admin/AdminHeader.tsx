import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';

export default function AdminHeader() {
  const { logout } = useAuth();

  return (
    <>
      <a className="skip-link" href="#admin-main">
        본문 바로가기
      </a>
      <header className="admin-header">
        <Link className="admin-header__action" to="/">
          메인 홈
        </Link>
        <button className="admin-header__action" type="button" onClick={logout}>
          로그아웃
        </button>
      </header>
    </>
  );
}

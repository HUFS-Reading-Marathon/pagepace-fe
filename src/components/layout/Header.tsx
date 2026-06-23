import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="site-logo">
        HUFS Reading Marathon
      </Link>

      <nav className="site-nav">
        <Link to="/login">로그인</Link>
        <Link to="/signup">회원가입</Link>
      </nav>
    </header>
  );
}

export default Header;
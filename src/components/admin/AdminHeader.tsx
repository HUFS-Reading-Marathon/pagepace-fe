import { Link } from 'react-router-dom';

function AdminHeader() {
  return (
    <>
      <a className="skip-link" href="#admin-main">
        본문 바로가기
      </a>

      <div className="topbar" role="region" aria-label="도서관 바로가기">
        <div className="wrap topbar-inner">
          <div className="topbar-title">
            Hankuk University of Foreign Studies · Global Campus Library
          </div>

          <nav className="topbar-links" aria-label="상단 유틸리티">
            <a
              href="https://lib.hufs.ac.kr/global/"
              target="_blank"
              rel="noopener noreferrer"
            >
              도서관 홈
            </a>

            <a
              href="https://www.hufs.ac.kr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              학교 홈페이지
            </a>

            <a href="/#contact">문의</a>
          </nav>
        </div>
      </div>

      <header className="site-header admin-header">
        <div className="wrap header-main admin-header__inner">
          <Link
            to="/admin"
            className="brand admin-header__brand"
            aria-label="독서마라톤 관리자 대시보드로 이동"
          >
            <img
              className="admin-header__logo"
              src="/hufs_global_library_logo.png"
              alt="한국외국어대학교 글로벌캠퍼스 도서관"
            />

            <span className="admin-header__title">
              독서마라톤 관리자
              <span className="admin-header__mode-badge">관리자 모드</span>
            </span>
          </Link>

          <Link to="/" className="admin-header__user-link">
            사용자 화면 보기
          </Link>
        </div>
      </header>
    </>
  );
}

export default AdminHeader;
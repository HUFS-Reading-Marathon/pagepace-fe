import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isAdminRole, useAuth } from '../../auth';
import { getExternalLinkAttrs } from '../../utils/links';

type HeaderLink = {
  label: string;
  href: string;
  external?: boolean;
};

const TOPBAR_LINKS: HeaderLink[] = [
  { label: '도서관 홈', href: 'https://lib.hufs.ac.kr/global/', external: true },
  { label: '학교 홈페이지', href: 'https://www.hufs.ac.kr/', external: true },
  { label: '문의', href: '/inquiries' },
];

// 주메뉴는 모두 독립 페이지로 이동합니다(메뉴명·순서는 메인페이지 섹션 순서와 같음).
// 메인페이지의 #섹션 주소(/#about 등)는 기존 링크 호환을 위해 MainPage가 계속 처리합니다.
const NAV_ITEMS: HeaderLink[] = [
  { label: '행사안내', href: '/about' },
  { label: '코스 및 혜택', href: '/courses' },
  { label: '참여방법', href: '/guide' },
  { label: '공지사항', href: '/notices' },
  { label: '대회 현황', href: '/status' },
];

const MY_LIBRARY_ITEMS: HeaderLink[] = [
  { label: '나의 현황', href: '/my' },
  { label: '나의 서재', href: '/logs' },
  { label: '계정 설정', href: '/my/settings' },
];

/** 현재 주소의 경로로 활성 메뉴를 정합니다. */
function isActiveNavItem(href: string, pathname: string) {
  // 하위 경로(예: 공지 상세 /notices/3)에서도 상위 메뉴를 활성화합니다.
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMyLibraryPath(pathname: string) {
  return pathname === '/my' || pathname.startsWith('/logs');
}

function isMyLibraryItemActive(href: string, pathname: string) {
  if (href === '/logs') {
    return pathname.startsWith('/logs');
  }

  return pathname === href;
}

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMyLibraryDropdownHidden, setIsMyLibraryDropdownHidden] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitializing, logout } = useAuth();
  const hasAuthSession = isAuthenticated || isInitializing;
  const hasAdminRole = isAdminRole(user?.role);

  const isMyLibraryActive = isMyLibraryPath(location.pathname);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const hideMyLibraryDropdown = () => {
    setIsMyLibraryDropdownHidden(true);
  };

  const handleLogout = () => {
    logout();
    closeMobileMenu();
    navigate('/');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        본문 바로가기
      </a>

      <div className="topbar" role="region" aria-label="도서관 바로가기">
        <div className="wrap topbar-inner">
          <div className="topbar-title">
            Hankuk University of Foreign Studies · Global Campus Library
          </div>

          <nav className="topbar-links" aria-label="상단 유틸리티">
            {TOPBAR_LINKS.map((link) =>
              link.external ? (
                <a key={link.label} href={link.href} {...getExternalLinkAttrs(link)}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.href}>
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-main">
          <Link
            className="brand"
            to="/"
            aria-label="한국외국어대학교 글로벌캠퍼스 도서관 독서마라톤 홈"
          >
            <img src="/hufs_global_library_logo.png" alt="한국외국어대학교 글로벌캠퍼스 도서관" />
          </Link>

          <nav className="global-nav" aria-label="주메뉴">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveNavItem(item.href, location.pathname);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'is-active' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}

            {hasAdminRole ? (
              <Link to="/admin" className="nav-login-link">
                관리자
              </Link>
            ) : (
              <div
                className={['nav-dropdown', isMyLibraryDropdownHidden ? 'is-hidden' : '']
                  .filter(Boolean)
                  .join(' ')}
                onMouseLeave={() => setIsMyLibraryDropdownHidden(false)}
              >
                <button
                  type="button"
                  className="nav-dropdown-trigger"
                  aria-haspopup="true"
                  aria-current={isMyLibraryActive ? 'page' : undefined}
                  onClick={() => {
                    hideMyLibraryDropdown();
                    navigate('/my');
                  }}
                >
                  나의 기록
                </button>
                <div className="nav-dropdown-menu" aria-label="나의 기록">
                  {MY_LIBRARY_ITEMS.map((item) => {
                    const isActive = isMyLibraryItemActive(item.href, location.pathname);

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={hideMyLibraryDropdown}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {hasAuthSession ? (
              <button
                type="button"
                className="nav-auth-button nav-login-link"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            ) : (
              <Link
                to="/login"
                aria-current={location.pathname === '/login' ? 'page' : undefined}
                className={[location.pathname === '/login' ? 'is-active' : '', 'nav-login-link']
                  .filter(Boolean)
                  .join(' ')}
              >
                로그인
              </Link>
            )}
          </nav>

          <button
            className="mobile-menu-button"
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobilePanel"
            aria-label="모바일 메뉴 열기"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <path
                d="M3 6h16M3 11h16M3 16h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </button>
        </div>

        <nav
          className={`mobile-panel ${isMobileMenuOpen ? 'is-open' : ''}`}
          id="mobilePanel"
          aria-label="모바일 주메뉴"
        >
          <div className="wrap">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveNavItem(item.href, location.pathname);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={closeMobileMenu}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'is-active' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}

            {hasAdminRole ? (
              <Link to="/admin" onClick={closeMobileMenu}>
                관리자 대시보드
              </Link>
            ) : (
              <div className="mobile-library-group">
                <Link
                  to="/my"
                  onClick={closeMobileMenu}
                  className={['mobile-library-title', isMyLibraryActive ? 'is-active' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  나의 기록
                </Link>
                {MY_LIBRARY_ITEMS.map((item) => {
                  const isActive = isMyLibraryItemActive(item.href, location.pathname);

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={closeMobileMenu}
                      aria-current={isActive ? 'page' : undefined}
                      className="mobile-library-link"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {hasAuthSession ? (
              <button type="button" className="mobile-auth-button" onClick={handleLogout}>
                로그아웃
              </button>
            ) : (
              <Link
                to="/login"
                onClick={closeMobileMenu}
                aria-current={location.pathname === '/login' ? 'page' : undefined}
                className={location.pathname === '/login' ? 'is-active' : undefined}
              >
                로그인
              </Link>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}

export default Header;

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type HeaderLink = {
  label: string;
  href: string;
  external?: boolean;
};

const TOPBAR_LINKS: HeaderLink[] = [
  { label: '도서관 홈', href: 'https://lib.hufs.ac.kr/global/', external: true },
  { label: '학교 홈페이지', href: 'https://www.hufs.ac.kr/', external: true },
  { label: '문의', href: '/#contact' },
];

const NAV_ITEMS: HeaderLink[] = [
  { label: '행사안내', href: '/#about' },
  { label: '코스 및 혜택', href: '/#courses' },
  { label: '참여방법', href: '/#process' },
  { label: '대회 현황', href: '/#status' },
  { label: '공지사항', href: '/#notice' },
  { label: 'My Library', href: '/my' },
];

const DEFAULT_HASH = '#about';
const SCROLL_SPY_TRIGGER_RATIO = 0.34;

function externalAttrs(link: HeaderLink) {
  return link.external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};
}

function isHashLink(href: string) {
  return href.startsWith('/#');
}

function hashFromHref(href: string) {
  return href.replace('/', '');
}

function getElementTop(element: HTMLElement) {
  return element.getBoundingClientRect().top + window.scrollY;
}

function getScrollSpySections() {
  return NAV_ITEMS
    .filter((item) => isHashLink(item.href))
    .map((item) => document.getElementById(hashFromHref(item.href).slice(1)))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .sort((a, b) => getElementTop(a) - getElementTop(b));
}

function getCurrentSectionHash() {
  const sections = getScrollSpySections();

  if (sections.length === 0) {
    return DEFAULT_HASH;
  }

  const isNearBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;

  if (isNearBottom) {
    return `#${sections[sections.length - 1].id}`;
  }

  const triggerY = window.scrollY + window.innerHeight * SCROLL_SPY_TRIGGER_RATIO;

  let activeSection = sections[0];

  sections.forEach((section) => {
    if (getElementTop(section) <= triggerY) {
      activeSection = section;
    }
  });

  return `#${activeSection.id}`;
}

function isActiveNavItem(href: string, pathname: string, activeHash: string) {
  if (href.startsWith('/#')) {
    return pathname === '/' && activeHash === hashFromHref(href);
  }

  if (href === '/my') {
    return pathname === '/my' || pathname.startsWith('/logs');
  }

  return pathname === href;
}

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSectionHash, setActiveSectionHash] = useState(DEFAULT_HASH);
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('isLoggedIn') === 'true',
  );

  const location = useLocation();
  const navigate = useNavigate();

  const activeHash =
    location.pathname === '/'
      ? activeSectionHash || location.hash || DEFAULT_HASH
      : location.hash;

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleHashLinkClick = (href: string) => {
    setActiveSectionHash(hashFromHref(href));
    closeMobileMenu();
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginId');

    setIsLoggedIn(false);
    closeMobileMenu();

    window.dispatchEvent(new Event('auth-change'));

    navigate('/');
  };

  useEffect(() => {
    const syncLoginState = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
    };

    syncLoginState();

    window.addEventListener('auth-change', syncLoginState);
    window.addEventListener('storage', syncLoginState);

    return () => {
      window.removeEventListener('auth-change', syncLoginState);
      window.removeEventListener('storage', syncLoginState);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSectionHash('');
      return;
    }

    const updateActiveSection = () => {
      const nextHash = getCurrentSectionHash();

      setActiveSectionHash((prevHash) =>
        prevHash === nextHash ? prevHash : nextHash,
      );
    };

    let animationFrameId = 0;

    const requestUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [location.pathname]);

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
                <a key={link.label} href={link.href} {...externalAttrs(link)}>
                  {link.label}
                </a>
              ) : (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
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
            <img
              src="/hufs_global_library_logo.png"
              alt="한국외국어대학교 글로벌캠퍼스 도서관"
            />
          </Link>

          <nav className="global-nav" aria-label="주메뉴">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveNavItem(
                item.href,
                location.pathname,
                activeHash,
              );

              const className = isActive ? 'is-active' : undefined;

              if (isHashLink(item.href)) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={className}
                    onClick={() => handleHashLinkClick(item.href)}
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={className}
                >
                  {item.label}
                </Link>
              );
            })}

            {isLoggedIn ? (
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
                className={[
                  location.pathname === '/login' ? 'is-active' : '',
                  'nav-login-link',
                ]
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
              const isActive = isActiveNavItem(
                item.href,
                location.pathname,
                activeHash,
              );

              if (isHashLink(item.href)) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => handleHashLinkClick(item.href)}
                    aria-current={isActive ? 'page' : undefined}
                    className={isActive ? 'is-active' : undefined}
                  >
                    {item.label}
                  </a>
                );
              }

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

            {isLoggedIn ? (
              <button
                type="button"
                className="mobile-auth-button"
                onClick={handleLogout}
              >
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
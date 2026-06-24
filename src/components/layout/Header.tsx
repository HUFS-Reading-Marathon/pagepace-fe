import { useState } from 'react';

type HeaderLink = {
  label: string;
  href: string;
  external?: boolean;
  current?: boolean;
};

const TOPBAR_LINKS: HeaderLink[] = [
  { label: '도서관 홈', href: 'https://lib.hufs.ac.kr/global/', external: true },
  { label: '학교 홈페이지', href: 'https://www.hufs.ac.kr/', external: true },
  { label: 'My Library', href: 'https://lib.hufs.ac.kr/global/#', external: true },
  { label: '문의', href: '/#contact' },
];

const NAV_ITEMS: HeaderLink[] = [
  { label: '행사안내', href: '/#about', current: true },
  { label: '코스 및 혜택', href: '/#courses' },
  { label: '참여방법', href: '/#process' },
  { label: '대회 현황', href: '/#status' },
  { label: '공지사항', href: '/#notice' },
  { label: '문의', href: '/#contact' },
];

function externalAttrs(link: HeaderLink) {
  return link.external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {};
}

function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <a className="skip-link" href="#main">
        본문 바로가기
      </a>

      <div className="topbar" role="region" aria-label="도서관 바로가기">
        <div className="wrap topbar-inner">
          <div className="topbar-title">
            한국외국어대학교 글로벌캠퍼스 도서관 독서마라톤
          </div>

          <nav className="topbar-links" aria-label="상단 유틸리티">
            {TOPBAR_LINKS.map((link) => (
              <a key={link.label} href={link.href} {...externalAttrs(link)}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-main">
          <a
            className="brand"
            href="/"
            aria-label="한국외국어대학교 글로벌캠퍼스 도서관 독서마라톤 홈"
          >
            <img
              src="/hufs-logo.png?v=2"
              alt="한국외국어대학교 글로벌캠퍼스 도서관"
            />
          </a>

          <nav className="global-nav" aria-label="주메뉴">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
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
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMobileMenu}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </header>
    </>
  );
}

export default Header;

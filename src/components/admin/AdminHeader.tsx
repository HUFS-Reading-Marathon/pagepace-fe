import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const ACCOUNT_POPOVER_ID = 'admin-account-popover';
const ACCOUNT_POPOVER_TITLE_ID = 'admin-account-popover-title';

function getAdminLoginId() {
  return localStorage.getItem('loginId')?.trim() || '';
}

function AdminHeader() {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [loginId, setLoginId] = useState(getAdminLoginId);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const accountLabel = loginId || '관리자';

  const closeAccountPopover = () => {
    setIsAccountOpen(false);
  };

  const handleLogout = () => {
    closeAccountPopover();

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginId');

    window.dispatchEvent(new Event('auth-change'));

    navigate('/');
  };

  useEffect(() => {
    const syncAccount = () => {
      setLoginId(getAdminLoginId());
    };

    window.addEventListener('auth-change', syncAccount);
    window.addEventListener('storage', syncAccount);

    return () => {
      window.removeEventListener('auth-change', syncAccount);
      window.removeEventListener('storage', syncAccount);
    };
  }, []);

  useEffect(() => {
    if (!isAccountOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      ) {
        closeAccountPopover();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAccountPopover();
        accountTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountOpen]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(closeAccountPopover);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [location.key]);

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

          <div className="admin-header__actions">
            <div className="admin-header__account" ref={accountRef}>
              <button
                ref={accountTriggerRef}
                type="button"
                className="admin-header__account-trigger"
                aria-haspopup="dialog"
                aria-expanded={isAccountOpen}
                aria-controls={ACCOUNT_POPOVER_ID}
                onClick={() => setIsAccountOpen((current) => !current)}
              >
                <svg
                  className="admin-header__account-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <circle
                    cx="9"
                    cy="6"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3.75 15c.35-2.55 2.2-4.25 5.25-4.25s4.9 1.7 5.25 4.25"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="admin-header__account-label" title={accountLabel}>
                  {accountLabel}
                </span>
                <svg
                  className="admin-header__account-chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path
                    d="m3 4.5 3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>

              {isAccountOpen && (
                <div
                  id={ACCOUNT_POPOVER_ID}
                  className="admin-header__account-popover"
                  role="dialog"
                  aria-modal="false"
                  aria-labelledby={ACCOUNT_POPOVER_TITLE_ID}
                >
                  <h2
                    id={ACCOUNT_POPOVER_TITLE_ID}
                    className="admin-header__account-title"
                  >
                    관리자 계정
                  </h2>

                  <dl className="admin-header__account-details">
                    <div className="admin-header__account-row">
                      <dt className="admin-header__account-key">아이디</dt>
                      <dd className="admin-header__account-value">
                        {accountLabel}
                      </dd>
                    </div>
                    <div className="admin-header__account-row">
                      <dt className="admin-header__account-key">권한</dt>
                      <dd className="admin-header__account-value">관리자</dd>
                    </div>
                  </dl>

                  <div className="admin-header__account-menu">
                    <Link
                      to="/"
                      className="admin-header__account-user-view"
                      onClick={closeAccountPopover}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 17 17"
                        aria-hidden="true"
                      >
                        <rect
                          x="2"
                          y="2.5"
                          width="13"
                          height="9"
                          rx="1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M6 14.5h5M8.5 11.5v3"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="1.4"
                        />
                      </svg>
                      사용자 화면 보기
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="admin-header__logout"
              aria-label="관리자 계정 로그아웃"
              title="로그아웃"
              onClick={handleLogout}
            >
              <svg
                className="admin-header__logout-icon"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                aria-hidden="true"
              >
                <path
                  d="M7.25 3.25H4.5A1.5 1.5 0 0 0 3 4.75v8.5a1.5 1.5 0 0 0 1.5 1.5h2.75M10.5 5.25 14.25 9l-3.75 3.75M14 9H7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export default AdminHeader;

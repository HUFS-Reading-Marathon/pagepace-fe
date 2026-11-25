import { startTransition, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { ADMIN_SIDEBAR_ID, ADMIN_SIDEBAR_TOGGLE_ID } from '../../layouts/adminSidebarState';

/* admin.css에서 접기 버튼 문구를 숨기고 아이콘만 두는 폭과 같은 기준입니다. */
const ICON_ONLY_TOGGLE_QUERY = '(max-width: 900px)';

function subscribeIconOnlyToggle(listener: () => void) {
  const query = window.matchMedia(ICON_ONLY_TOGGLE_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** 접기 버튼이 아이콘만 보이는 좁은 화면인지. 이때만 마우스 툴팁(title)으로 현재 동작을 알려 줍니다. */
function useIconOnlyToggle() {
  return useSyncExternalStore(
    subscribeIconOnlyToggle,
    () => window.matchMedia(ICON_ONLY_TOGGLE_QUERY).matches,
    () => false,
  );
}

type AdminHeaderProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

/**
 * 관리자 상단 바. 사용자 화면의 네이비 상단 바(.topbar) 한 줄에 맨 왼쪽 사이드바 접기 버튼과 도서관 홈·메인 홈·로그아웃을 둡니다.
 * 스크롤해도 보이도록 sticky이며, 높이는 admin.css의 --admin-header-height와 맞춥니다.
 */
function AdminHeader({ sidebarCollapsed, onToggleSidebar }: AdminHeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const iconOnlyToggle = useIconOnlyToggle();
  const toggleText = sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기';

  // 로그아웃과 이동을 한 번에 반영해, 관리자 보호 라우트가 먼저 /login으로 보내지 않게 합니다.
  const handleLogout = () => {
    startTransition(() => {
      logout();
      navigate('/');
    });
  };

  return (
    <>
      <a className="skip-link" href="#admin-main">
        본문 바로가기
      </a>

      <header className="topbar admin-topbar">
        {/* 접기 버튼은 가운데 정렬된 .wrap 밖, 상단 바 맨 왼쪽에 고정해 사이드바 상태와 관계없이 같은 자리에 둡니다. */}
        <div className="admin-topbar__bar">
          <button
            id={ADMIN_SIDEBAR_TOGGLE_ID}
            type="button"
            className="admin-topbar__sidebar-toggle"
            aria-label={sidebarCollapsed ? '관리자 메뉴 펼치기' : '관리자 메뉴 접기'}
            title={iconOnlyToggle ? toggleText : undefined}
            aria-expanded={!sidebarCollapsed}
            aria-controls={ADMIN_SIDEBAR_ID}
            onClick={onToggleSidebar}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <rect
                x="2.25"
                y="3.25"
                width="13.5"
                height="11.5"
                rx="1.75"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path d="M6.75 3.5v11" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {/* 두 문구를 같은 칸에 겹쳐 두어, 문구가 바뀌어도 버튼 폭이 그대로입니다. */}
            <span className="admin-topbar__toggle-label" aria-hidden="true">
              <span data-active={!sidebarCollapsed || undefined}>메뉴 접기</span>
              <span data-active={sidebarCollapsed || undefined}>메뉴 펼치기</span>
            </span>
          </button>

          <div className="wrap topbar-inner admin-topbar__inner">
            <div className="topbar-title">
              Hankuk University of Foreign Studies · Global Campus Library
            </div>

            <nav className="topbar-links admin-topbar__links" aria-label="관리자 상단 메뉴">
              <a href="https://lib.hufs.ac.kr/global/" target="_blank" rel="noopener noreferrer">
                도서관 홈
              </a>

              <Link to="/">메인 홈</Link>

              <button type="button" className="admin-topbar__logout" onClick={handleLogout}>
                <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M7.25 3.25H4.5A1.5 1.5 0 0 0 3 4.75v8.5a1.5 1.5 0 0 0 1.5 1.5h2.75M10.5 5.25 14.25 9l-3.75 3.75M14 9H7"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
                로그아웃
              </button>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

export default AdminHeader;

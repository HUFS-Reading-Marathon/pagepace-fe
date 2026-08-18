import { NavLink } from 'react-router-dom';

const ADMIN_MENUS = [
  {
    label: '오늘의 업무',
    path: '/admin',
    group: '매일 하는 업무',
    enabled: true,
  },
  {
    label: '참가자 관리',
    path: '/admin/participants',
    group: '매일 하는 업무',
    enabled: true,
  },
  {
    label: '독서일지 검토',
    path: '/admin/logs',
    group: '매일 하는 업무',
    enabled: true,
  },
  {
    label: '서평 확인',
    path: '/admin/reviews',
    group: '매일 하는 업무',
    enabled: true,
  },
  {
    label: '행사/코스 설정',
    path: '/admin/event',
    group: '운영 관리',
    enabled: true,
  },
  {
    label: '대회 현황 관리',
    path: '/admin/status',
    group: '운영 관리',
    enabled: true,
  },
  {
    label: '공지사항 관리',
    path: '/admin/notices',
    group: '운영 관리',
    enabled: true,
  },
  {
    label: '참가자 랭킹',
    path: '/admin/rankings',
    group: '운영 관리',
    enabled: true,
  },
  {
    label: '운영 통계',
    path: '/admin/statistics',
    group: '분석',
    enabled: true,
  },
] as const;

function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <nav aria-label="관리자 메뉴">
        <ul className="admin-sidebar__menu">
          {ADMIN_MENUS.map((menu, index) => (
            <li className="admin-sidebar__item" key={menu.path}>
              {(index === 0 || ADMIN_MENUS[index - 1].group !== menu.group) && <span className="admin-sidebar__group">{menu.group}</span>}
              {menu.enabled ? (
                <NavLink
                  to={menu.path}
                  end={menu.path === '/admin'}
                  className={({ isActive }) =>
                    [
                      'admin-sidebar__link',
                      isActive ? 'admin-sidebar__link--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  {menu.label}
                </NavLink>
              ) : (
                <button
                  type="button"
                  className="admin-sidebar__link admin-sidebar__link--disabled"
                  disabled
                >
                  <span>{menu.label}</span>
                  <small className="admin-sidebar__status">준비 중</small>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default AdminSidebar;

import { NavLink } from 'react-router-dom';

const ADMIN_MENUS = [
  {
    label: '관리자 대시보드',
    path: '/admin',
    enabled: true,
  },
  {
    label: '참가자 관리',
    path: '/admin/participants',
    enabled: false,
  },
  {
    label: '독서일지 검토',
    path: '/admin/logs',
    enabled: false,
  },
  {
    label: '행사/코스 설정',
    path: '/admin/event',
    enabled: false,
  },
  {
    label: '대회 현황 관리',
    path: '/admin/status',
    enabled: false,
  },
] as const;

function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <nav aria-label="관리자 메뉴">
        <ul className="admin-sidebar__menu">
          {ADMIN_MENUS.map((menu) => (
            <li className="admin-sidebar__item" key={menu.path}>
              {menu.enabled ? (
                <NavLink
                  to={menu.path}
                  end
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

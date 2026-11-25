import { useId, useState } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router-dom';

type AdminMenu = {
  label: string;
  path: string;
  group: '참가·기록' | '운영 관리' | '분석';
  relatedPaths?: readonly string[];
};

const ADMIN_MENUS: readonly AdminMenu[] = [
  {
    label: '운영 현황',
    path: '/admin',
    group: '참가·기록',
  },
  {
    label: '참가자 관리',
    path: '/admin/participants',
    group: '참가·기록',
  },
  {
    label: '독서일지 검토',
    path: '/admin/logs',
    group: '참가·기록',
  },
  {
    label: '서평 확인',
    path: '/admin/reviews',
    group: '참가·기록',
  },
  {
    label: '행사/코스 설정',
    path: '/admin/event',
    group: '운영 관리',
  },
  {
    label: '대회 현황·랭킹',
    path: '/admin/status',
    group: '운영 관리',
    // 참가 현황과 공식 랭킹은 같은 메뉴 안에서 탭으로 오갑니다.
    relatedPaths: ['/admin/rankings'],
  },
  {
    label: '공지사항 관리',
    path: '/admin/notices',
    group: '운영 관리',
  },
  {
    label: '문의·FAQ 관리',
    path: '/admin/inquiries',
    group: '운영 관리',
    // 도서 확인 요청(이전 주소)은 이 메뉴의 도서 문의 탭으로 옮겨졌습니다.
    relatedPaths: ['/admin/book-requests'],
  },
  { label: '결과 보고서', path: '/admin/reports', group: '분석' },
  {
    label: '운영 통계',
    path: '/admin/statistics',
    group: '분석',
  },
];

type AdminMenuGroup = AdminMenu['group'];

function isMenuActive(menu: AdminMenu, pathname: string) {
  return [menu.path, ...(menu.relatedPaths ?? [])].some((path) =>
    matchPath({ path, end: path === '/admin' }, pathname),
  );
}

const INITIAL_OPEN_GROUPS = ADMIN_MENUS.reduce(
  (groups, menu) => ({ ...groups, [menu.group]: true }),
  {} as Record<AdminMenuGroup, boolean>,
);

/** 메뉴 순서를 그대로 둔 채 그룹별로 묶습니다. */
const ADMIN_MENU_GROUPS = ADMIN_MENUS.reduce<{ group: AdminMenuGroup; menus: AdminMenu[] }[]>(
  (groups, menu) => {
    const last = groups[groups.length - 1];
    if (last?.group === menu.group) {
      last.menus.push(menu);
    } else {
      groups.push({ group: menu.group, menus: [menu] });
    }
    return groups;
  },
  [],
);

type AdminSidebarProps = {
  id?: string;
  /** 데스크톱에서 사이드바를 접은 상태. 접히면 안의 링크에 포커스가 가지 않도록 inert로 둡니다. */
  hidden?: boolean;
  /**
   * 그룹을 접을 수 있는 세로 사이드바인지. 휴대폰 폭의 가로 메뉴에서는 그룹 제목이 없으므로
   * 모든 메뉴를 보이고 접힌 그룹도 inert로 두지 않습니다.
   */
  collapsibleGroups?: boolean;
};

function AdminSidebar({ id, hidden = false, collapsibleGroups = true }: AdminSidebarProps) {
  const { pathname } = useLocation();
  const panelIdPrefix = useId();
  const [openGroups, setOpenGroups] = useState(INITIAL_OPEN_GROUPS);
  const activeGroup = ADMIN_MENUS.find((menu) => isMenuActive(menu, pathname))?.group;

  const toggleGroup = (group: AdminMenuGroup) => {
    if (group === activeGroup) {
      return;
    }

    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  return (
    <aside id={id} className="admin-sidebar" inert={hidden}>
      <nav className="admin-sidebar__inner" aria-label="관리자 메뉴">
        <ul className="admin-sidebar__menu">
          {ADMIN_MENU_GROUPS.map(({ group, menus }, groupIndex) => {
            const isGroupOpen = openGroups[group] || activeGroup === group;
            const panelId = `${panelIdPrefix}group-${groupIndex}`;

            return (
              <li className="admin-sidebar__section" key={group}>
                <button
                  type="button"
                  className="admin-sidebar__group"
                  aria-expanded={isGroupOpen}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group)}
                >
                  <span>{group}</span>
                  <svg
                    className="admin-sidebar__group-chevron"
                    width="11"
                    height="11"
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
                {/* 닫힌 그룹도 DOM에 두고 높이(grid 0fr↔1fr)와 투명도로 접어, 아래 그룹이 부드럽게 따라 움직입니다. */}
                <div
                  id={panelId}
                  className="admin-sidebar__panel"
                  data-open={isGroupOpen || undefined}
                  inert={collapsibleGroups && !isGroupOpen}
                >
                  <div className="admin-sidebar__panel-inner">
                    <ul className="admin-sidebar__links">
                      {menus.map((menu) => (
                        <li className="admin-sidebar__item" key={menu.path}>
                          <NavLink
                            to={menu.path}
                            end={menu.path === '/admin'}
                            className={({ isActive }) =>
                              [
                                'admin-sidebar__link',
                                isActive || isMenuActive(menu, pathname)
                                  ? 'admin-sidebar__link--active'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')
                            }
                          >
                            {menu.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default AdminSidebar;

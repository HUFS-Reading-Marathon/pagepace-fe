import { NavLink } from 'react-router-dom';

export type AdminPageTab = {
  label: string;
  to: string;
};

type AdminPageTabsProps = {
  label: string;
  tabs: readonly AdminPageTab[];
};

/** 하나의 사이드바 메뉴 안에서 관련 화면을 오가는 상단 탭입니다. */
function AdminPageTabs({ label, tabs }: AdminPageTabsProps) {
  return (
    <nav className="admin-page-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            ['admin-page-tabs__link', isActive ? 'admin-page-tabs__link--active' : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default AdminPageTabs;

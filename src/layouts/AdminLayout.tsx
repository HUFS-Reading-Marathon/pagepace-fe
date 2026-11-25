import { useEffect, useState, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router-dom';
import AdminHeader from '../components/admin/AdminHeader';
import AdminSidebar from '../components/admin/AdminSidebar';
import {
  ADMIN_SIDEBAR_ID,
  ADMIN_SIDEBAR_TOGGLE_ID,
  readSidebarCollapsed,
  saveSidebarCollapsed,
} from './adminSidebarState';
import '../styles/admin.css';

/* 700px 이하에서는 사이드바가 가로 메뉴로 바뀌므로 접힘 상태를 적용하지 않습니다(admin.css와 같은 기준). */
const SIDE_LAYOUT_QUERY = '(min-width: 701px)';

function subscribeSideLayout(listener: () => void) {
  const query = window.matchMedia(SIDE_LAYOUT_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function useSideLayout() {
  return useSyncExternalStore(
    subscribeSideLayout,
    () => window.matchMedia(SIDE_LAYOUT_QUERY).matches,
    () => true,
  );
}

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const sideLayout = useSideLayout();
  // 모바일 가로 메뉴는 데스크톱에서 접어 둔 상태와 관계없이 항상 보입니다.
  const sidebarHidden = collapsed && sideLayout;

  useEffect(() => saveSidebarCollapsed(collapsed), [collapsed]);

  const toggleSidebar = () => {
    const next = !collapsed;
    // 접히는 사이드바 안에 포커스가 있었다면 토글 버튼으로 옮깁니다.
    if (next && document.getElementById(ADMIN_SIDEBAR_ID)?.contains(document.activeElement)) {
      document.getElementById(ADMIN_SIDEBAR_TOGGLE_ID)?.focus();
    }
    setCollapsed(next);
  };

  return (
    <div className={`admin-layout${sidebarHidden ? ' admin-layout--sidebar-collapsed' : ''}`}>
      <AdminHeader sidebarCollapsed={sidebarHidden} onToggleSidebar={toggleSidebar} />

      <div className="admin-layout__body">
        <AdminSidebar id={ADMIN_SIDEBAR_ID} hidden={sidebarHidden} collapsibleGroups={sideLayout} />

        <main id="admin-main" className="admin-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

import { Outlet } from 'react-router-dom';
import AdminHeader from '../components/admin/AdminHeader';
import AdminSidebar from '../components/admin/AdminSidebar';
import '../styles/admin.css';

function AdminLayout() {
  return (
    <div className="admin-layout">
      <AdminHeader />

      <div className="admin-layout__body">
        <AdminSidebar />

        <main id="admin-main" className="admin-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { LoginPage, ApplyPage, ApplyPendingPage } from '../pages/auth';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import NotFoundPage from '../pages/error';
import MainPage from '../pages/main';
import MyPage from '../pages/my';
import {
  MyReadingLogsPage,
  ReadingLogDetailPage,
  ReadingLogWritePage,
} from '../pages/logs';
import MarathonStatusPage from '../pages/status';

function UserLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
        </Route>

        <Route element={<UserLayout />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<ApplyPage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/apply/pending" element={<ApplyPendingPage />} />

          <Route path="/my" element={<MyPage />} />
          <Route path="/logs" element={<MyReadingLogsPage />} />
          <Route path="/logs/new" element={<ReadingLogWritePage />} />
          <Route path="/logs/:logId" element={<ReadingLogDetailPage />} />

          <Route path="/status" element={<MarathonStatusPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

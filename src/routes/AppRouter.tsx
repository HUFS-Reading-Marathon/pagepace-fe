import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { LoginPage, ApplyPage, ApplyPendingPage, PasswordResetPage } from '../pages/auth';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminOperationsDashboardPage from '../pages/admin/AdminOperationsDashboardPage';
import AdminParticipantsPage from '../pages/admin/AdminParticipantsPage';
import AdminReadingLogsPage from '../pages/admin/AdminReadingLogsPage';
import AdminEventSettingsPage from '../pages/admin/AdminEventSettingsPage';
import AdminStatusPage from '../pages/admin/AdminStatusPage';
import AdminRankingPage from '../pages/admin/AdminRankingPage';
import AdminReviewsPage from '../pages/admin/AdminReviewsPage';
import AdminNoticesPage from '../pages/admin/AdminNoticesPage';
import RankingPage from '../pages/rankings/RankingPage';
import NoticeDetailPage from '../pages/notices/NoticeDetailPage';
import AccountSettingsPage from '../pages/my/AccountSettingsPage';
import NotFoundPage from '../pages/error';
import MainPage from '../pages/main';
import MyPage from '../pages/my';
import { MyReadingLogsPage, ReadingLogDetailPage, ReadingLogWritePage } from '../pages/logs';
import MarathonStatusPage from '../pages/status';
import { AuthProvider } from '../auth';
import ProtectedRoute from './ProtectedRoute';

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
      <AuthProvider>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOperationsDashboardPage />} />
            <Route path="participants" element={<AdminParticipantsPage />} />
            <Route path="logs" element={<AdminReadingLogsPage />} />
            <Route path="event" element={<AdminEventSettingsPage />} />
            <Route path="status" element={<AdminStatusPage />} />
            <Route path="statistics" element={<AdminDashboardPage />} />
            <Route path="rankings" element={<AdminRankingPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="notices" element={<AdminNoticesPage />} />
          </Route>

          <Route element={<UserLayout />}>
            <Route path="/" element={<MainPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/password-reset" element={<PasswordResetPage />} />
            <Route path="/signup" element={<ApplyPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/apply/pending" element={<ApplyPendingPage />} />

            <Route
              path="/my"
              element={
                <ProtectedRoute>
                  <MyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my/settings"
              element={
                <ProtectedRoute>
                  <AccountSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <MyReadingLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs/new"
              element={
                <ProtectedRoute>
                  <ReadingLogWritePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs/:logId"
              element={
                <ProtectedRoute>
                  <ReadingLogDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs/:logId/edit"
              element={
                <ProtectedRoute>
                  <ReadingLogWritePage />
                </ProtectedRoute>
              }
            />

            <Route path="/status" element={<MarathonStatusPage />} />
            <Route path="/rankings" element={<RankingPage />} />
            <Route path="/notices/:id" element={<NoticeDetailPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRouter;

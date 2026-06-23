import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from '../components/layout/Header';
import MainPage from '../pages/main';
import { LoginPage, SignUpPage } from '../pages/auth';
import NotFoundPage from '../pages/error';

function AppRouter() {
  return (
    <BrowserRouter>
      <Header />

      <main className="page-container">
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default AppRouter;
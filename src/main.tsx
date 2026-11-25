import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MOCK_MODE } from './mocks/mockMode';
import './styles/global.css';

// 목데이터 모드 표시는 개발 서버의 목데이터 모드에서만 불러옵니다(운영 빌드에서는 제거됨).
const MockBadge = import.meta.env.DEV && MOCK_MODE ? lazy(() => import('./mocks/MockBadge')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {MockBadge && (
      <Suspense fallback={null}>
        <MockBadge />
      </Suspense>
    )}
  </StrictMode>,
);

/**
 * 로컬 UI/UX 검토용 목데이터 모드.
 *
 * 개발 서버(import.meta.env.DEV)에서 VITE_ENABLE_MOCKS=true일 때만 켜집니다.
 * 운영 빌드에서는 import.meta.env.DEV가 false 상수로 바뀌어 이 값이 항상 false이고,
 * 목데이터 코드는 동적 import 경로째 번들에서 빠집니다.
 */
export const MOCK_MODE: boolean =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true';

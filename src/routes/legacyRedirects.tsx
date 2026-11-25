import { Navigate, useLocation } from 'react-router-dom';
import { legacyTabSearch } from './legacyTabSearch';

/** 기존 주소로 들어오면 기록을 남기지 않고(replace) 통합된 화면의 탭으로 옮깁니다. */
export function LegacyTabRedirect({ to, view }: { to: string; view: string }) {
  const location = useLocation();
  return <Navigate replace to={{ pathname: to, search: legacyTabSearch(location.search, view) }} />;
}

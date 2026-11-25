import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 사용자 화면에서 다른 페이지로 이동하면 맨 위에서 시작합니다.
 * - 뒤로·앞으로 가기(POP)는 브라우저가 이전 스크롤 위치를 되돌리도록 그대로 둡니다.
 * - 주소에 #섹션이 있으면 해당 페이지가 그 위치로 스크롤합니다(예: /#contact).
 * - 같은 페이지 안에서 검색어·쪽 번호(?q=, ?page=)만 바뀌는 경우는 스크롤을 건드리지 않습니다.
 */
export default function ScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return;
    window.scrollTo(0, 0);
    // 경로가 바뀔 때만 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

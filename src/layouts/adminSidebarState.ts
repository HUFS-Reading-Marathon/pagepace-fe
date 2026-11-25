/** 관리자 화면 전용 사이드바 접힘 상태 저장 키(인증 저장소와 별개). */
export const ADMIN_SIDEBAR_STORAGE_KEY = 'pagepace:admin:sidebar-collapsed';
export const ADMIN_SIDEBAR_ID = 'admin-sidebar';
export const ADMIN_SIDEBAR_TOGGLE_ID = 'admin-sidebar-toggle';

/** 최초 방문(저장값 없음)이나 저장소를 읽을 수 없으면 펼친 상태입니다. */
export function readSidebarCollapsed() {
  try {
    return localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // 저장소를 쓸 수 없어도 현재 화면의 접힘 상태는 그대로 동작합니다.
  }
}

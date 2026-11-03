import type { AdminPageTab } from '../components/admin/AdminPageTabs';

/** 대회 현황·랭킹 메뉴 안의 탭 */
export const COMPETITION_TABS: readonly AdminPageTab[] = [
  { label: '참가 현황', to: '/admin/status' },
  { label: '공식 랭킹', to: '/admin/rankings' },
];

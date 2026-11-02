import type { ProcessStepIconName } from '../../pages/main/mainPageContent';

const ICON_PATHS: Record<ProcessStepIconName, string[]> = {
  // 신청서(문서 + 펜)
  apply: [
    'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4',
    'M13 3v4a1 1 0 0 0 1 1h4',
    'M13 3l5 5v3',
    'M9 12h5',
    'M9 16h2',
    'M19.5 14.5a1.5 1.5 0 0 1 2.1 2.1L17 21.2l-2.8.7.7-2.8z',
  ],
  // 펼친 책
  log: [
    'M12 7v13',
    'M3 5.5A1.5 1.5 0 0 1 4.5 4H9a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4.5A1.5 1.5 0 0 1 21 5.5v11a1.5 1.5 0 0 1-1.5 1.5H15a3 3 0 0 0-3 3 3 3 0 0 0-3-3H4.5A1.5 1.5 0 0 1 3 16.5z',
  ],
  // 서평(말풍선 + 글줄)
  review: ['M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z', 'M8 8h8', 'M8 12h5'],
  // 완주(트로피)
  finish: [
    'M7 4h10v5a5 5 0 0 1-10 0z',
    'M7 6H4.5a.5.5 0 0 0-.5.5V8a3 3 0 0 0 3 3',
    'M17 6h2.5a.5.5 0 0 1 .5.5V8a3 3 0 0 1-3 3',
    'M12 14v3',
    'M8 21h8',
    'M9.5 21v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2',
  ],
};

/** 메인 참여방법 단계에 표시하는 선형 아이콘 */
function ProcessStepIcon({ name }: { name: ProcessStepIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default ProcessStepIcon;

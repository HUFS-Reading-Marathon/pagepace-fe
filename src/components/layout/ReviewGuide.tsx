export default function ReviewGuide() {
  return (
    <>
      <a
        className="review-library-link"
        href="https://lib.hufs.ac.kr/global/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="도서관 홈페이지 바로가기 (새 탭)"
      >
        도서관 홈페이지 바로가기 ↗
      </a>
      <details className="review-guide">
        <summary>서평 작성 방법</summary>
        <ol>
          <li>도서관 홈페이지에 로그인합니다.</li>
          <li>해당 도서의 상세 페이지에서 서평을 작성합니다.</li>
          <li>담당자가 서평을 확인하면 승인된 독서량이 거리로 반영됩니다.</li>
        </ol>
        <p>PagePace와 도서관 홈페이지의 로그인은 별개입니다.</p>
        <ul>
          <li>완독 전에도 서평을 작성할 수 있습니다.</li>
          <li>서평 확인을 기다리는 동안에도 독서일지를 제출할 수 있습니다.</li>
          <li>서평 작성 사실을 별도로 알릴 필요는 없습니다.</li>
        </ul>
      </details>
    </>
  );
}

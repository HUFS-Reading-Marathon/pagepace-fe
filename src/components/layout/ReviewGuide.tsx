export default function ReviewGuide() {
  return (
    <details className="review-guide">
      <summary>서평은 도서관 홈페이지에서 작성해요</summary>
      <p>
        이 행사 사이트의 로그인과 도서관 로그인은 별개입니다. 외부 사이트에서 작성한 내용은 자동으로
        가져오지 않습니다.
      </p>
      <ol>
        <li>
          <strong>도서관으로 이동</strong>
          <span>책의 ‘도서관에서 서평 작성’ 버튼을 누르면 새 탭이 열립니다.</span>
        </li>
        <li>
          <strong>도서관 로그인 후 작성</strong>
          <span>해당 도서를 찾아 상세 화면에서 서평을 작성하고 저장하세요.</span>
        </li>
        <li>
          <strong>이 화면으로 돌아오기</strong>
          <span>
            저장을 마쳤으면 ‘도서관에서 서평을 작성했어요’를 체크해 주세요. 추천을 숨길 뿐, 이
            체크만으로 실적이 반영되지는 않습니다.
          </span>
        </li>
        <li>
          <strong>도서관 담당자 확인</strong>
          <span>담당자가 작성 기록을 확인한 뒤 인정 거리를 반영합니다.</span>
        </li>
      </ol>
      <p>
        완독하지 않아도 읽은 분량에 대한 서평을 작성할 수 있습니다. 서평 확인을 기다리는 동안에도
        다음 독서일지를 제출할 수 있습니다.
      </p>
    </details>
  );
}

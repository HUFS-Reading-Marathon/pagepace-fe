function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <div className="footer-title">한국외국어대학교 글로벌캠퍼스 도서관</div>
          <p className="footer-info">HUFS Global Campus Library · Reading Marathon Program</p>
        </div>

        <nav className="footer-links" aria-label="푸터 바로가기">
          <a href="/#about">행사안내</a>
          <a href="/#courses">코스</a>
          <a href="/#process">참여방법</a>
          <a href="/#status">대회 현황</a>
          <a href="/#contact">문의</a>
        </nav>
      </div>

      <div className="wrap footer-copy">
        Copyright © Hankuk University of Foreign Studies Global Campus Library. All Rights Reserved.
      </div>
    </footer>
  );
}

export default Footer;

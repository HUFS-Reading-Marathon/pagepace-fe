import type { ReactNode } from 'react';
import './user-page.css';

type Props = {
  title: string;
  /** 제목 오른쪽(좁은 화면에서는 아래)에 두는 짧은 정보. 예: 전체 건수 */
  aside?: ReactNode;
  /** 제목 아래 한 줄 설명(필요한 페이지만) */
  description?: ReactNode;
};

/** 사용자 독립 페이지(공지사항·행사안내·코스 및 혜택·참여방법)의 공통 제목 영역 */
export default function UserPageHeader({ title, aside, description }: Props) {
  return (
    <header className="user-page__head">
      <div>
        <h1>{title}</h1>
        {description && <p className="user-page__description">{description}</p>}
      </div>
      {aside}
    </header>
  );
}

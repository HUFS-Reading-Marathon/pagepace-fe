import { Link } from 'react-router-dom';
import UserPageHeader from '../../components/layout/UserPageHeader';
import CourseBenefitTable from '../../components/main/CourseBenefitTable';
import { useCurrentEventInfo } from '../main/useCurrentEventInfo';
import EventLoadMessage from './EventLoadMessage';
import '../main/MainPage.css';
import './info-pages.css';

/** 코스 및 혜택: 현재 행사의 코스별 목표 거리·기준 도서 수·월평균 독서량·보상(관리자 코스 설정 기준) */
export default function CoursesPage() {
  const { currentEvent, eventCourses, eventError, coursesLoaded } = useCurrentEventInfo();

  return (
    <main id="main" className="wrap user-page info-page">
      <UserPageHeader title="코스 및 혜택" description={currentEvent?.title} />
      <EventLoadMessage error={eventError} />

      {!eventError && !coursesLoaded ? (
        <p className="info-page__message" role="status">
          코스 정보를 불러오는 중입니다.
        </p>
      ) : coursesLoaded && eventCourses.length === 0 ? (
        <p className="info-page__message" role="status">
          공개된 코스가 없습니다.
        </p>
      ) : (
        coursesLoaded && (
          <section className="info-page__section" aria-label="코스 및 혜택 표">
            <CourseBenefitTable courses={eventCourses} />
            <p className="table-note">추가 대출 기간과 시상 기준은 공지사항을 따릅니다.</p>
            <p className="info-page__links">
              <Link to="/guide">참여방법 보기 →</Link>
            </p>
          </section>
        )
      )}
    </main>
  );
}

import UserPageHeader from '../../components/layout/UserPageHeader';
import EventContactCard from '../../components/main/EventContactCard';
import { useCurrentEventInfo } from '../main/useCurrentEventInfo';
import AboutIntro from './AboutIntro';
import EventApplyCta from './EventApplyCta';
import EventLoadMessage from './EventLoadMessage';
import '../main/MainPage.css';
import './info-pages.css';

/** 행사안내: 포스터와 행사 소개·핵심 수치·일정(2열), 문의 및 운영 정보, 참가신청 연결 */
export default function AboutPage() {
  const { currentEvent, eventCourses, eventError } = useCurrentEventInfo();

  return (
    <main id="main" className="wrap user-page info-page">
      <UserPageHeader title="행사안내" description={currentEvent?.title} />
      <EventLoadMessage error={eventError} />

      <AboutIntro
        currentEvent={currentEvent}
        courseCount={eventCourses.length}
        loading={!currentEvent && !eventError}
      />

      <section className="info-page__section" aria-labelledby="contactTitle">
        <EventContactCard currentEvent={currentEvent} />
      </section>

      <EventApplyCta currentEvent={currentEvent} loaded={!!currentEvent || !!eventError} />
    </main>
  );
}

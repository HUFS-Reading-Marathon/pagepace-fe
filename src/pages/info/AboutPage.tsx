import UserPageHeader from '../../components/layout/UserPageHeader';
import EventAboutCard from '../../components/main/EventAboutCard';
import EventContactCard from '../../components/main/EventContactCard';
import { formatKoDateKey } from '../../utils/date';
import { useCurrentEventInfo } from '../main/useCurrentEventInfo';
import EventApplyCta from './EventApplyCta';
import EventLoadMessage from './EventLoadMessage';
import '../main/MainPage.css';
import './info-pages.css';

const range = (start: string, end: string) => `${formatKoDateKey(start)} ~ ${formatKoDateKey(end)}`;

/** 행사안내: 행사 소개, 일정(참가신청·독서일지 접수 기간), 문의 및 운영 정보, 참가신청 연결 */
export default function AboutPage() {
  const { currentEvent, eventCourses, eventError } = useCurrentEventInfo();
  const description = currentEvent?.description?.trim();

  return (
    <main id="main" className="wrap user-page info-page">
      <UserPageHeader title="행사안내" description={currentEvent?.title} />
      <EventLoadMessage error={eventError} />

      <section className="info-page__section" aria-labelledby="aboutIntroTitle">
        <h2 id="aboutIntroTitle">행사 소개</h2>
        <EventAboutCard courseCount={eventCourses.length} />
        {description && <p className="info-page__text">{description}</p>}
      </section>

      {currentEvent && (
        <section className="info-page__section" aria-labelledby="aboutScheduleTitle">
          <h2 id="aboutScheduleTitle">행사 일정</h2>
          <dl className="info-page__facts">
            <div>
              <dt>참가신청 기간</dt>
              <dd>{range(currentEvent.applicationStartDate, currentEvent.applicationEndDate)}</dd>
            </div>
            <div>
              <dt>독서일지 접수 기간</dt>
              <dd>{range(currentEvent.eventStartDate, currentEvent.eventEndDate)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="info-page__section" aria-labelledby="contactTitle">
        <EventContactCard currentEvent={currentEvent} />
      </section>

      <EventApplyCta currentEvent={currentEvent} loaded={!!currentEvent || !!eventError} />
    </main>
  );
}

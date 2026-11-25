import UserPageHeader from '../../components/layout/UserPageHeader';
import ParticipationChecklist from '../../components/main/ParticipationChecklist';
import ProcessGuide from '../../components/main/ProcessGuide';
import { useCurrentEventInfo } from '../main/useCurrentEventInfo';
import EventApplyCta from './EventApplyCta';
import '../main/MainPage.css';
import './info-pages.css';

/** 참여방법: 참가신청 → 독서일지 작성 → 도서관 서평 작성 → 거리 인정 및 완주, 참여 전 확인사항 */
export default function GuidePage() {
  const { currentEvent, eventError } = useCurrentEventInfo();

  return (
    <main id="main" className="wrap user-page info-page">
      <UserPageHeader title="참여방법" />

      <section className="info-page__section" aria-label="참여 단계">
        <ProcessGuide />
      </section>

      <section className="info-page__section info-page__checklist">
        <ParticipationChecklist />
      </section>

      <EventApplyCta currentEvent={currentEvent} loaded={!!currentEvent || !!eventError} />
    </main>
  );
}

import { useState } from 'react';
import { ABOUT_SUMMARY, aboutHighlights } from '../../components/main/aboutContent';
import type { CurrentEvent } from '../../api/eventApi';
import { formatKoDateKey } from '../../utils/date';
import EventPosterPanel from './EventPosterPanel';
import { posterForRound } from './eventPosters';
import './about-intro.css';

const range = (start: string, end: string) => `${formatKoDateKey(start)} ~ ${formatKoDateKey(end)}`;

/**
 * 행사안내의 행사 소개: 왼쪽에 공식 포스터, 오른쪽에 행사 소개·핵심 수치·행사 일정.
 * 포스터는 등록된 회차에만 보이며(로그인 여부와 무관), 없으면 소개가 전체 너비를 씁니다.
 */
export default function AboutIntro({
  currentEvent,
  courseCount,
  loading,
}: {
  currentEvent: CurrentEvent | null;
  courseCount: number;
  /** 행사 정보를 아직 불러오는 중(오류가 나지 않은 상태) */
  loading: boolean;
}) {
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = posterFailed ? null : posterForRound(currentEvent?.roundNo);
  const description = currentEvent?.description?.trim();
  // 불러오는 동안에는 포스터 자리를 잡아 두어, 도착한 뒤 소개가 밀리지 않게 합니다.
  const reserve = loading && !currentEvent;

  return (
    <section
      className={['about-intro', poster || reserve ? 'has-poster' : ''].filter(Boolean).join(' ')}
      aria-labelledby="aboutIntroTitle"
      aria-busy={reserve || undefined}
    >
      <h2 id="aboutIntroTitle" className="sr-only">
        행사 소개
      </h2>

      {poster && currentEvent ? (
        <div className="about-intro__poster">
          <EventPosterPanel
            poster={poster}
            title={currentEvent.title}
            onUnavailable={() => setPosterFailed(true)}
          />
        </div>
      ) : (
        reserve && <div className="about-intro__poster about-intro__poster--reserve" aria-hidden />
      )}

      <div className="about-intro__body">
        <h3>독서마라톤이란?</h3>
        <p className="about-intro__summary">{ABOUT_SUMMARY}</p>
        {description && <p className="about-intro__description">{description}</p>}

        <dl className="about-intro__figures" aria-label="독서마라톤 핵심 수치">
          {aboutHighlights(courseCount).map(({ title, caption }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{caption}</dd>
            </div>
          ))}
        </dl>

        {currentEvent && (
          <>
            <h3 id="aboutScheduleTitle">행사 일정</h3>
            <dl
              className="info-page__facts about-intro__schedule"
              aria-labelledby="aboutScheduleTitle"
            >
              <div>
                <dt>참가신청 기간</dt>
                <dd>{range(currentEvent.applicationStartDate, currentEvent.applicationEndDate)}</dd>
              </div>
              <div>
                <dt>독서일지 접수 기간</dt>
                <dd>{range(currentEvent.eventStartDate, currentEvent.eventEndDate)}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </section>
  );
}

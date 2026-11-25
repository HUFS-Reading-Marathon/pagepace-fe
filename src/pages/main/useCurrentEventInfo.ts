import { useEffect, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { getCurrentEvent, getEventCourses, type CurrentEvent } from '../../api/eventApi';
import { toCourseRow, type CourseRow } from './mainPageContent';

/** 'missing': 공개된 행사가 없음(404 EVENT_NOT_FOUND), 'failed': 그 외 조회 실패 */
export type EventLoadError = 'missing' | 'failed' | null;

/**
 * 현재 공개 행사와 코스(코스 및 혜택 표 행)를 불러옵니다. 메인페이지와 행사안내·코스 및 혜택 페이지가
 * 같은 기준(관리자 행사/코스 설정의 저장값)으로 보이도록 한곳에서 조회합니다.
 */
export function useCurrentEventInfo() {
  const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);
  const [eventCourses, setEventCourses] = useState<CourseRow[]>([]);
  const [eventError, setEventError] = useState<EventLoadError>(null);
  const [coursesLoaded, setCoursesLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentEvent()
      .then(async (event) => {
        if (!active) return;
        setCurrentEvent(event);
        const courses = await getEventCourses(event.eventId);
        if (!active) return;
        setEventCourses(courses.map(toCourseRow));
        setCoursesLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setEventError(
          error instanceof ApiError && error.code === 'EVENT_NOT_FOUND' ? 'missing' : 'failed',
        );
      });
    return () => {
      active = false;
    };
  }, []);

  return { currentEvent, eventCourses, eventError, coursesLoaded };
}

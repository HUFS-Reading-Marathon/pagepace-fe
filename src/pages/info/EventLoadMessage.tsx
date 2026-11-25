import type { EventLoadError } from '../main/useCurrentEventInfo';

/** 행사 조회 실패·공개 행사 없음 안내(메인페이지와 같은 문구) */
export default function EventLoadMessage({ error }: { error: EventLoadError }) {
  if (!error) return null;
  return error === 'missing' ? (
    <p className="info-page__message" role="status">
      현재 공개된 독서마라톤 행사가 없습니다.
    </p>
  ) : (
    <p className="info-page__message" role="alert">
      행사 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
    </p>
  );
}

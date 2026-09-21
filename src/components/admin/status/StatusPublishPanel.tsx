import { formatKoDateTime24 } from '../../../utils/date';

type StatusPublishPanelProps = {
  lastCalculatedAt: string | null;
  isRefreshing: boolean;
  canRefresh: boolean;
  onRecalculate: () => void;
};

function StatusPublishPanel({
  lastCalculatedAt,
  isRefreshing,
  canRefresh,
  onRecalculate,
}: StatusPublishPanelProps) {
  return (
    <section
      className="admin-status__publish-panel"
      aria-labelledby="statusPublishPanelTitle"
    >
      <div className="admin-status__publish-heading">
        <div>
          <div className="admin-status__title-row">
            <h2 id="statusPublishPanelTitle">공개·내보내기</h2>
            <span className="admin-status__publish-state admin-status__publish-state--private">
              API 확인 필요
            </span>
          </div>
          <p>
            현황 공개와 Excel/CSV 내보내기는 확인된 백엔드 API가 없어
            실행하지 않습니다.
          </p>
        </div>
      </div>

      <div className="admin-status__publish-body">
        <dl className="admin-status__publish-meta">
          <div>
            <dt>마지막 서버 조회</dt>
            <dd>
              {lastCalculatedAt
                ? formatKoDateTime24(lastCalculatedAt)
                : '조회 이력 없음'}
            </dd>
          </div>
          <div>
            <dt>완주 판정</dt>
            <dd>백엔드 필드 필요</dd>
          </div>
          <div>
            <dt>현황 공개</dt>
            <dd>백엔드 API 필요</dd>
          </div>
          <div>
            <dt>Excel/CSV</dt>
            <dd>백엔드 export API 필요</dd>
          </div>
        </dl>

        <div className="admin-status__visibility-settings">
          <label>
            <input type="checkbox" checked disabled readOnly />
            <span>
              <strong>이름 마스킹</strong>
              <small>공개 API 연동 후 설정할 수 있습니다.</small>
            </span>
          </label>
          <label>
            <input type="checkbox" disabled readOnly />
            <span>
              <strong>순위 공개</strong>
              <small>공식 순위 API가 확인되지 않았습니다.</small>
            </span>
          </label>
        </div>
      </div>

      <div className="admin-status__actions">
        <p>선택한 행사의 실제 신청·독서일지·코스 데이터를 다시 조회합니다.</p>
        <div>
          <button
            type="button"
            disabled={!canRefresh || isRefreshing}
            onClick={onRecalculate}
          >
            {isRefreshing ? '조회 중…' : '집계 다시 계산'}
          </button>
          <button type="button" disabled title="백엔드 export API 필요">
            엑셀 다운로드
          </button>
          <button
            type="button"
            className="admin-status__button--primary"
            disabled
            title="백엔드 공개 API 필요"
          >
            현황 공개
          </button>
        </div>
      </div>
    </section>
  );
}

export default StatusPublishPanel;

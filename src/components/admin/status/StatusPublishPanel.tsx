import type {
  StatusSnapshot,
  StatusVisibilitySettings,
} from '../../../types/adminStatus';
import {
  formatStatusDate,
  formatStatusDateTime,
} from '../../../utils/statusAggregation';

type StatusPublishPanelProps = {
  isPublic: boolean;
  hasUnpublishedChanges: boolean;
  settings: StatusVisibilitySettings;
  lastCalculatedAt: string;
  lastPublishedAt: string | null;
  publishedSnapshot: StatusSnapshot | null;
  canDownload: boolean;
  onSettingsChange: (
    field: keyof StatusVisibilitySettings,
    checked: boolean,
  ) => void;
  onRecalculate: () => void;
  onDownload: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
};

function StatusPublishPanel({
  isPublic,
  hasUnpublishedChanges,
  settings,
  lastCalculatedAt,
  lastPublishedAt,
  publishedSnapshot,
  canDownload,
  onSettingsChange,
  onRecalculate,
  onDownload,
  onPublish,
  onUnpublish,
}: StatusPublishPanelProps) {
  const publishButtonLabel = isPublic
    ? hasUnpublishedChanges
      ? '공개본 업데이트'
      : '공개본 최신 상태'
    : '현황 공개';

  return (
    <section
      className="admin-status__publish-panel"
      aria-labelledby="statusPublishPanelTitle"
    >
      <div className="admin-status__publish-heading">
        <div>
          <div className="admin-status__title-row">
            <h2 id="statusPublishPanelTitle">공개 설정</h2>
            <span
              className={`admin-status__publish-state admin-status__publish-state--${
                isPublic ? 'public' : 'private'
              }`}
            >
              {isPublic ? '공개 중' : '비공개'}
            </span>
            {hasUnpublishedChanges && (
              <span className="admin-status__changes-badge">
                미공개 변경사항 있음
              </span>
            )}
          </div>
          <p>
            미리보기 설정은 공개본에 즉시 반영되지 않으며, 현황 공개 또는
            공개본 업데이트 시 저장됩니다.
          </p>
        </div>
      </div>

      <div className="admin-status__publish-body">
        <dl className="admin-status__publish-meta">
          <div>
            <dt>마지막 집계</dt>
            <dd>{formatStatusDateTime(lastCalculatedAt)}</dd>
          </div>
          <div>
            <dt>마지막 공개</dt>
            <dd>
              {lastPublishedAt
                ? formatStatusDateTime(lastPublishedAt)
                : '공개 이력 없음'}
            </dd>
          </div>
          <div>
            <dt>공개 기준 날짜</dt>
            <dd>
              {publishedSnapshot
                ? formatStatusDate(publishedSnapshot.baseDate)
                : '—'}
            </dd>
          </div>
          <div>
            <dt>공개 참가자</dt>
            <dd>
              {publishedSnapshot
                ? `${publishedSnapshot.participants.length}명`
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="admin-status__visibility-settings">
          <label>
            <input
              type="checkbox"
              checked={settings.maskNames}
              onChange={(event) =>
                onSettingsChange('maskNames', event.target.checked)
              }
            />
            <span>
              <strong>이름 마스킹</strong>
              <small>공개 미리보기에서 참가자 이름을 가립니다.</small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.showRanks}
              onChange={(event) =>
                onSettingsChange('showRanks', event.target.checked)
              }
            />
            <span>
              <strong>순위 공개</strong>
              <small>공개 화면에 코스별 순위를 표시합니다.</small>
            </span>
          </label>
        </div>
      </div>

      <div className="admin-status__actions">
        <p>
          집계 다시 계산은 현재 초안만 갱신하며 기존 공개본은 변경하지
          않습니다.
        </p>
        <div>
          <button type="button" onClick={onRecalculate}>
            집계 다시 계산
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={onDownload}
          >
            엑셀 다운로드
          </button>
          <button
            type="button"
            className="admin-status__button--primary"
            disabled={isPublic && !hasUnpublishedChanges}
            onClick={onPublish}
          >
            {publishButtonLabel}
          </button>
          {isPublic && (
            <button
              type="button"
              className="admin-status__button--danger"
              onClick={onUnpublish}
            >
              비공개 전환
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default StatusPublishPanel;


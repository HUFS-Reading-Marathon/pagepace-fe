import {Link} from 'react-router-dom';
import {formatStatusDateTime} from '../../../utils/statusAggregation';
type Props = {lastCalculatedAt:string|null;isRefreshing:boolean;canRefresh:boolean;onRecalculate:()=>void;publicVisible:boolean;canExport:boolean;onExport:()=>void};
export default function StatusPublishPanel({lastCalculatedAt,isRefreshing,canRefresh,onRecalculate,publicVisible,canExport,onExport}:Props) {
  return <section className="admin-status__publish-panel" aria-labelledby="statusPublishPanelTitle">
    <div className="admin-status__publish-heading"><div><h2 id="statusPublishPanelTitle">공개·내보내기</h2>
      <p>{publicVisible?'이 행사는 사용자 대회 현황에 공개되어 있습니다.':'이 행사는 사용자 대회 현황에 공개되지 않습니다.'} 공개 여부는 행사 설정에서 변경합니다.</p></div></div>
    <div className="admin-status__publish-body"><dl className="admin-status__publish-meta">
      <div><dt>마지막 서버 조회</dt><dd>{lastCalculatedAt?formatStatusDateTime(lastCalculatedAt):'조회 이력 없음'}</dd></div>
      <div><dt>완주 판정</dt><dd>서버 참가 상태 기준</dd></div><div><dt>공개 이름</dt><dd>항상 마스킹</dd></div>
      <div><dt>CSV 범위</dt><dd>현재 검색·필터 결과</dd></div></dl></div>
    <div className="admin-status__actions"><p>승인 쪽수와 서평 인정 거리는 별도로 집계됩니다.</p><div>
      <button type="button" disabled={!canRefresh||isRefreshing} onClick={onRecalculate}>{isRefreshing?'조회 중…':'최신 현황 조회'}</button>
      <button type="button" disabled={!canExport} onClick={onExport}>CSV 다운로드</button>
      <Link to="/admin/event">공개 설정</Link><Link to="/admin/rankings">공식 랭킹</Link>
    </div></div>
  </section>;
}

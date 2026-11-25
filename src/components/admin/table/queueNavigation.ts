/**
 * 처리 후 이어서 볼 대상: 처리 전 순서에서 뒤쪽을 먼저, 그다음 앞쪽을 가까운 순으로 보고
 * 최신 목록에 남아 있는 첫 대상을 고릅니다. 후보가 모두 처리됐으면 최신 목록의 첫 대상을 씁니다.
 */
export function nextCandidateId(before: number[], processedId: number, after: number[]) {
  const index = before.indexOf(processedId);
  const candidates =
    index < 0 ? [] : [...before.slice(index + 1), ...before.slice(0, index).reverse()];
  const remaining = new Set(after);
  remaining.delete(processedId);
  return (
    candidates.find((id) => remaining.has(id)) ?? after.find((id) => id !== processedId) ?? null
  );
}

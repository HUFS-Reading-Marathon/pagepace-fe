/**
 * 일반 사용자 화면의 참가자 이름 마스킹(서버 RankingService.maskName과 같은 규칙).
 * - 한 글자: *
 * - 두 글자: 김*
 * - 세 글자 이상: 첫 글자 + * + 마지막 글자 (예: 김*준, 남*리). 이름 길이가 드러나지 않도록 가운데는 * 하나로 둡니다.
 * 이미 서버에서 가린 이름(* 포함)은 다시 가리지 않습니다.
 */
export function maskName(name: string | null | undefined) {
  const value = (name ?? '').trim();
  if (!value) return '';
  if (value.includes('*')) return value;
  const letters = [...value];
  if (letters.length === 1) return '*';
  if (letters.length === 2) return `${letters[0]}*`;
  return `${letters[0]}*${letters[letters.length - 1]}`;
}

type NamedRow = { participationId: number; name: string; studentNo?: string };

/**
 * 공개 랭킹 행의 이름을 가리고 학번을 지웁니다. 본인 행(인증된 사용자의 참가 ID와 같은 행)만
 * 본인 이름을 그대로 보여 줍니다. 이름 비교로 본인을 판단하지 않습니다.
 */
export function maskPublicRankings<Row extends NamedRow>(
  rows: Row[],
  mine?: { participationId: number; name: string },
): Row[] {
  return rows.map((row) => {
    const { studentNo: _studentNo, ...rest } = row;
    void _studentNo;
    return {
      ...rest,
      name: mine && row.participationId === mine.participationId ? mine.name : maskName(row.name),
    } as Row;
  });
}

import { describe, expect, it } from 'vitest';
import { maskName, maskPublicRankings } from '../src/utils/nameMask';

describe('사용자 화면 이름 마스킹', () => {
  it('글자 수에 따라 가운데를 가린다', () => {
    expect(maskName('김')).toBe('*');
    expect(maskName('김준')).toBe('김*');
    expect(maskName('김민준')).toBe('김*준');
    expect(maskName('남궁민수')).toBe('남*수');
    expect(maskName(' 김민준 ')).toBe('김*준');
    expect(maskName('')).toBe('');
    expect(maskName(null)).toBe('');
  });

  it('서버가 이미 가린 이름은 다시 가리지 않는다', () => {
    expect(maskName('김*준')).toBe('김*준');
    expect(maskName('*')).toBe('*');
  });

  it('본인 행만 참가 ID로 찾아 본인 이름을 보이고, 학번은 지운다', () => {
    const rows = [
      { participationId: 1, name: '정*늘', studentNo: '202400001' },
      { participationId: 2, name: '신준서', studentNo: '202400002' },
    ];
    const shown = maskPublicRankings(rows, { participationId: 1, name: '정하늘' });
    expect(shown.map((row) => row.name)).toEqual(['정하늘', '신*서']);
    expect(shown.every((row) => !('studentNo' in row))).toBe(true);
    // 이름이 같아도 참가 ID가 다르면 본인으로 보지 않습니다.
    const sameName = maskPublicRankings([{ participationId: 3, name: '정하늘' }], {
      participationId: 1,
      name: '정하늘',
    });
    expect(sameName[0].name).toBe('정*늘');
    expect(maskPublicRankings(rows).map((row) => row.name)).toEqual(['정*늘', '신*서']);
  });
});

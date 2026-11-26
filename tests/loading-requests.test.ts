import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/apiClient';

function setup() {
  let token = 'reader-a';
  vi.stubGlobal('localStorage', { getItem: () => token });
  const replies: Array<(value: Response) => void> = [];
  const fetch = vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve)));
  vi.stubGlobal('fetch', fetch);
  return {
    fetch,
    switchAccount: () => {
      token = 'reader-b';
    },
    reply: (index: number, data: unknown) =>
      replies[index](Response.json({ success: true, code: 'OK', message: '', data })),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('동시 조회와 재조회', () => {
  it('같은 조회만 공유하고 응답이 끝난 뒤에는 새 데이터를 요청한다', async () => {
    const server = setup();
    const first = apiRequest('/api/events/1');
    const second = apiRequest('/api/events/1', { method: 'GET' });
    expect(server.fetch).toHaveBeenCalledTimes(1);
    server.reply(0, [{ id: 1 }]);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    const next = apiRequest('/api/events/1');
    expect(server.fetch).toHaveBeenCalledTimes(2);
    server.reply(1, []);
    await expect(next).resolves.toEqual([]);
  });

  it('회차·계정·중단 신호가 다른 조회는 독립적으로 완료된다', async () => {
    const server = setup();
    const path = '/api/me/participations/current?eventId=1';
    const a = apiRequest(path);
    const b = apiRequest('/api/me/participations/current?eventId=2');
    server.switchAccount();
    const c = apiRequest(path);
    const d = apiRequest(path, { signal: new AbortController().signal });
    expect(server.fetch).toHaveBeenCalledTimes(4);
    for (const index of [2, 0, 3, 1]) server.reply(index, index);
    await expect(Promise.all([a, b, c, d])).resolves.toEqual([0, 1, 2, 3]);
  });

  it('저장 전이나 저장 중의 응답이 늦어져도 저장 후의 상세 재조회를 대체하지 않는다', async () => {
    const server = setup();
    const path = '/api/reading-logs/1';
    const before = apiRequest(path);
    const save = apiRequest(path, { method: 'PATCH' });
    const during = apiRequest(path);
    server.reply(1, 'saved');
    await save;
    const after = apiRequest(path);
    server.reply(0, 'old');
    server.reply(2, 'old');
    await Promise.all([before, during]);
    const joined = apiRequest(path);
    expect(server.fetch).toHaveBeenCalledTimes(4);
    server.reply(3, 'updated');
    await expect(Promise.all([after, joined])).resolves.toEqual(['updated', 'updated']);
  });
});

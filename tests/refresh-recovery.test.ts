import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/apiClient';
import { ACCESS_TOKEN_STORAGE_KEY } from '../src/auth/authStorage';

afterEach(() => vi.unstubAllGlobals());

describe('일시적 연결 장애 후 인증 갱신', () => {
  function session() {
    const values = new Map([[ACCESS_TOKEN_STORAGE_KEY, 'original']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    vi.stubGlobal('window', new EventTarget());
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    return { values, fetch };
  }

  it('일시적 통신 실패 후 같은 세션으로 다음 조회를 수행한다', async () => {
    const { values, fetch } = session();
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(values.get(ACCESS_TOKEN_STORAGE_KEY)).toBe('original');
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const ok = (data: unknown) => Response.json({ success: true, code: 'OK', message: '', data });
    fetch.mockResolvedValueOnce(ok({ accessToken: 'renewed' }));
    fetch.mockResolvedValueOnce(ok({ name: 'reader' }));
    await expect(apiRequest('/api/me')).resolves.toEqual({ name: 'reader' });
    expect(values.get(ACCESS_TOKEN_STORAGE_KEY)).toBe('renewed');
  });

  it('서버가 갱신 자격 만료를 확인하면 세션을 종료한다', async () => {
    const { values, fetch } = session();
    fetch.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })));
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(values.has(ACCESS_TOKEN_STORAGE_KEY)).toBe(false);
  });

  it('리프레시 쿠키가 없다는 400 응답(REFRESH_REQUIRED)도 세션을 종료한다', async () => {
    const { values, fetch } = session();
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetch.mockResolvedValueOnce(
      Response.json(
        { success: false, code: 'REFRESH_REQUIRED', message: '리프레시 토큰이 필요합니다.' },
        { status: 400 },
      ),
    );
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 400 });
    expect(values.has(ACCESS_TOKEN_STORAGE_KEY)).toBe(false);
  });

  it('갱신 요청의 서버 오류(5xx)는 세션을 유지해 다음 요청에서 다시 갱신한다', async () => {
    const { values, fetch } = session();
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 503 });
    expect(values.get(ACCESS_TOKEN_STORAGE_KEY)).toBe('original');
  });
});

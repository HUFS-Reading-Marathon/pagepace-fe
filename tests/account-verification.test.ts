import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '../src/api/apiClient';
import { confirmApplicationEmailVerification, createApplication } from '../src/api/applicationApi';
import { confirmPasswordReset } from '../src/api/authApi';
import { updateMe } from '../src/api/meApi';

afterEach(() => vi.restoreAllMocks());

describe('이메일 인증을 사용하는 폼의 API 계약', () => {
  it('인증 토큰과 동의 버전을 참가 신청에 전달한다', async () => {
    const request = vi
      .spyOn(client, 'apiRequest')
      .mockResolvedValueOnce({ verificationToken: 'test-proof' })
      .mockResolvedValueOnce({ applicationId: 1 });
    const email = 'reader@example.test';
    const token = await confirmApplicationEmailVerification(email, '123456');
    await createApplication({
      eventId: 3,
      name: '시연 독자',
      studentNo: '10001',
      email,
      phone: '01000000000',
      affiliationType: 'STAFF',
      department: '도서관',
      privacyConsentVersion: 'application-v1',
      verificationToken: token,
    });
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({
      email,
      verificationToken: 'test-proof',
      privacyConsentVersion: 'application-v1',
    });
  });

  it('서버가 인증 토큰을 생략하면 인증 완료로 진행할 수 없다', async () => {
    vi.spyOn(client, 'apiRequest').mockResolvedValue({});
    await expect(
      confirmApplicationEmailVerification('reader@example.test', '123456'),
    ).rejects.toThrow();
  });

  it('비밀번호 설정과 이메일 변경에 필요한 필드를 전달한다', async () => {
    const request = vi.spyOn(client, 'apiRequest').mockResolvedValue(null);
    const email = 'new@example.test';
    await confirmPasswordReset('10001', email, '123456', 'local-new-password');
    await updateMe({
      name: '독자',
      email,
      phone: '',
      department: '도서관',
      affiliationType: 'STAFF',
      verificationToken: 'new-address-proof',
    });
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({
      newPassword: 'local-new-password',
    });
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({
      email,
      verificationToken: 'new-address-proof',
    });
  });
});
